import { RadioTrack, RadioTrackStatus, Playlist, Schedule } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { r2StorageService } from './r2-storage.service';
import type { UploadFile } from '../lib/upload-file';
import type {
  CreateTrackDto,
  UpdateTrackDto,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  ReorderPlaylistTracksDto,
} from '../schemas/radio';

class RadioService {

  /**
   * Adiciona uma nova música à playlist
   */
  async addTrack(createTrackDto: CreateTrackDto, file: UploadFile, userId: string): Promise<RadioTrack> {
    const { key, url } = await r2StorageService.uploadFile(file);

    return prisma.radioTrack.create({
      data: {
        title: createTrackDto.title,
        artist: createTrackDto.artist,
        band: createTrackDto.band,
        album: createTrackDto.album,
        genre: createTrackDto.genre,
        duration: createTrackDto.duration,
        fileUrl: url,
        r2Key: key,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: createTrackDto.status || RadioTrackStatus.ACTIVE,
        priority: createTrackDto.priority || 0,
        addedById: userId,
      },
      include: {
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Lista todas as músicas
   */
  async findAllTracks(status?: RadioTrackStatus): Promise<RadioTrack[]> {
    const where = status ? { status } : {};
    
    return prisma.radioTrack.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Busca uma música por ID
   */
  async findTrackById(id: string): Promise<RadioTrack> {
    const track = await prisma.radioTrack.findUnique({
      where: { id },
      include: {
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!track) {
      throw new HttpError(404, `Track with ID ${id} not found`, 'Not Found');
    }

    return track;
  }

  /**
   * Atualiza uma música
   */
  async updateTrack(id: string, updateTrackDto: UpdateTrackDto): Promise<RadioTrack> {
    await this.findTrackById(id);

    return prisma.radioTrack.update({
      where: { id },
      data: updateTrackDto,
      include: {
        addedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Remove uma música (e o arquivo do R2)
   */
  async removeTrack(id: string): Promise<void> {
    const track = await this.findTrackById(id);

    // Remove arquivo do R2
    try {
      await r2StorageService.deleteFile(track.r2Key);
    } catch (error) {
      console.error(`Error deleting file from R2: ${error}`);
      // Continua mesmo se falhar ao deletar do R2
    }

    // Remove do banco
    await prisma.radioTrack.delete({
      where: { id },
    });
  }

  /**
   * Reordena a playlist
   */
  async reorderPlaylist(tracks: { id: string; priority: number }[]): Promise<void> {
    await Promise.all(
      tracks.map(({ id, priority }) =>
        prisma.radioTrack.update({
          where: { id },
          data: { priority },
        })
      )
    );
  }

  /**
   * Obtém a playlist ativa ordenada
   * Agora verifica se há um schedule ativo primeiro
   */
  async getActivePlaylist(): Promise<RadioTrack[]> {
    const currentSchedule = await this.getCurrentSchedule();
    
    if (currentSchedule && currentSchedule.playlist) {
      // Retorna tracks da playlist do schedule, ordenados
      const playlistTracks = await prisma.playlistTrack.findMany({
        where: {
          playlistId: currentSchedule.playlistId,
        },
        include: {
          track: true,
        },
        orderBy: {
          order: 'asc',
        },
      });
      
      return playlistTracks.map(pt => pt.track).filter(t => t.status === RadioTrackStatus.ACTIVE);
    }
    
    // Fallback para playlist padrão (todas as músicas ativas)
    return prisma.radioTrack.findMany({
      where: {
        status: RadioTrackStatus.ACTIVE,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Obtém a música atual
   */
  async getCurrentTrack(): Promise<RadioTrack | null> {
    const config = await this.getRadioConfig();
    
    if (!config.currentTrackId) {
      return null;
    }

    try {
      return await this.findTrackById(config.currentTrackId);
    } catch {
      return null;
    }
  }

  /**
   * Obtém ou cria a configuração da rádio (sempre retorna o primeiro registro)
   */
  async getRadioConfig() {
    // Garante que existe apenas um registro de configuração
    let config = await prisma.radioConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      config = await prisma.radioConfig.create({
        data: {
          isPlaying: false,
        },
      });
    }

    // Se houver múltiplos registros, mantém apenas o mais recente
    const allConfigs = await prisma.radioConfig.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    if (allConfigs.length > 1) {
      // Remove os registros antigos, mantendo apenas o primeiro
      const idsToDelete = allConfigs.slice(1).map(c => c.id);
      await prisma.radioConfig.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    return config;
  }

  /**
   * Atualiza a configuração da rádio
   */
  async updateRadioConfig(data: { isPlaying?: boolean; currentTrackId?: string | null }) {
    const config = await this.getRadioConfig();

    return prisma.radioConfig.update({
      where: { id: config.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calcula qual música está tocando no momento e retorna sua URL do R2
   */
  async getCurrentTrackUrl(): Promise<{ url: string; track: RadioTrack } | null> {
    // Verifica se há schedule ativo
    const currentSchedule = await this.getCurrentSchedule();
    if (!currentSchedule) {
      return null;
    }

    const playlist = await this.getActivePlaylist();
    if (playlist.length === 0) {
      return null;
    }

    // Calcula qual música está tocando baseado no horário
    const trackIndex = await this.calculateCurrentTrackIndex(playlist, currentSchedule);
    const track = playlist[trackIndex % playlist.length];

    // Retorna a URL do R2
    if (!track.fileUrl || !track.fileUrl.startsWith('http')) {
      // Se não tem URL pública, gera uma presigned URL
      const presignedUrl = await r2StorageService.generatePresignedUrl(track.r2Key, 3600);
      return { url: presignedUrl, track };
    }

    return { url: track.fileUrl, track };
  }

  /**
   * Calcula o índice da música atual baseado no horário do schedule
   */
  async calculateCurrentTrackIndex(playlist: RadioTrack[], schedule: Schedule & { playlist: Playlist }): Promise<number> {
    const now = new Date();
    const scheduleStart = this.timeStringToSeconds(schedule.startTime);
    
    // Calcula o horário de início do schedule hoje
    const scheduleStartDate = new Date(now);
    scheduleStartDate.setHours(Math.floor(scheduleStart / 3600));
    scheduleStartDate.setMinutes(Math.floor((scheduleStart % 3600) / 60));
    scheduleStartDate.setSeconds(scheduleStart % 60);
    scheduleStartDate.setMilliseconds(0);

    // Se o horário atual é antes do início do schedule, retorna 0
    if (now < scheduleStartDate) {
      return 0;
    }

    // Calcula quantos segundos se passaram desde o início do schedule
    const elapsedSeconds = Math.floor((now.getTime() - scheduleStartDate.getTime()) / 1000);

    // Calcula qual música está tocando somando as durações
    let accumulatedDuration = 0;
    for (let i = 0; i < playlist.length; i++) {
      const trackDuration = playlist[i].duration || 180; // Default 3 minutos se não tiver duração
      if (elapsedSeconds < accumulatedDuration + trackDuration) {
        return i;
      }
      accumulatedDuration += trackDuration;
    }

    // Se passou de todas as músicas, calcula quantas vezes a playlist tocou (loop)
    const totalPlaylistDuration = playlist.reduce((sum, track) => sum + (track.duration || 180), 0);
    if (totalPlaylistDuration === 0) return 0;
    
    const remainingSeconds = elapsedSeconds % totalPlaylistDuration;
    
    accumulatedDuration = 0;
    for (let i = 0; i < playlist.length; i++) {
      const trackDuration = playlist[i].duration || 180;
      if (remainingSeconds < accumulatedDuration + trackDuration) {
        return i;
      }
      accumulatedDuration += trackDuration;
    }

    return 0;
  }

  /**
   * Inicia transmissão (apenas marca como playing no banco)
   */
  async startBroadcast(): Promise<void> {
    const currentSchedule = await this.getCurrentSchedule();
    if (!currentSchedule) {
      await this.updateRadioConfig({ isPlaying: false });
      throw new HttpError(400, 'No active schedule at this time', 'Bad Request');
    }

    const playlist = await this.getActivePlaylist();
    if (playlist.length === 0) {
      await this.updateRadioConfig({ isPlaying: false });
      throw new HttpError(400, 'No tracks available in playlist', 'Bad Request');
    }

    await this.updateRadioConfig({ isPlaying: true });
  }

  /**
   * Pausa transmissão
   */
  async pauseBroadcast(): Promise<void> {
    await this.updateRadioConfig({ isPlaying: false });
  }

  /**
   * Converte string de horário (HH:mm) para segundos desde meia-noite
   */
  timeStringToSeconds(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 3600 + minutes * 60;
  }

  /**
   * Obtém segundos desde meia-noite do horário atual
   */
  getTimeInSeconds(date: Date): number {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }

  /**
   * Resolve a URL pública (ou presigned) de uma track
   */
  private async resolveTrackUrl(track: RadioTrack): Promise<string> {
    if (track.fileUrl && track.fileUrl.startsWith('http')) {
      return track.fileUrl;
    }
    return r2StorageService.generatePresignedUrl(track.r2Key, 3600);
  }

  /**
   * Playlist pública com URLs resolvidas para o player do site.
   * O frontend avança as faixas localmente; startIndex só sugere onde começar.
   */
  async getPublicPlaylist() {
    const config = await this.getRadioConfig();
    const currentSchedule = await this.getCurrentSchedule();
    const playlist = await this.getActivePlaylist();

    let startIndex = 0;
    if (currentSchedule && playlist.length > 0) {
      startIndex = await this.calculateCurrentTrackIndex(playlist, currentSchedule);
      startIndex = startIndex % playlist.length;
    }

    const tracks = await Promise.all(
      playlist.map(async (track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        fileUrl: await this.resolveTrackUrl(track),
      })),
    );

    return {
      isPlaying: config.isPlaying,
      playlistName: currentSchedule?.playlist?.name ?? 'TRANSMISSÃO BRUTAL',
      startIndex,
      tracks,
    };
  }

  /**
   * Obtém status da rádio
   */
  async getStatus() {
    const config = await this.getRadioConfig();
    const playlist = await this.getActivePlaylist();
    const currentSchedule = await this.getCurrentSchedule();
    
    // Obtém a URL da música atual usando o cálculo baseado no horário
    const currentTrackInfo = await this.getCurrentTrackUrl();
    const currentTrack = currentTrackInfo?.track || null;

    return {
      isPlaying: config.isPlaying,
      currentTrack: currentTrack && currentTrackInfo ? {
        ...currentTrack,
        fileUrl: currentTrackInfo.url, // URL atualizada (pode ser presigned se necessário)
      } : null,
      playlistLength: playlist.length,
      totalTracks: await prisma.radioTrack.count(),
      currentSchedule: currentSchedule ? {
        id: currentSchedule.id,
        dayOfWeek: currentSchedule.dayOfWeek,
        startTime: currentSchedule.startTime,
        endTime: currentSchedule.endTime,
        playlistName: currentSchedule.playlist.name,
        playlistId: currentSchedule.playlistId,
      } : null,
    };
  }

  /**
   * Obtém estatísticas
   */
  async getStats() {
    const totalTracks = await prisma.radioTrack.count();
    const activeTracks = await prisma.radioTrack.count({
      where: { status: RadioTrackStatus.ACTIVE },
    });
    const archivedTracks = await prisma.radioTrack.count({
      where: { status: RadioTrackStatus.ARCHIVED },
    });
    const totalPlays = await prisma.radioTrack.aggregate({
      _sum: {
        playCount: true,
      },
    });

    return {
      totalTracks,
      activeTracks,
      archivedTracks,
      totalPlays: totalPlays._sum.playCount || 0,
    };
  }

  // ========== PLAYLIST METHODS ==========

  /**
   * Cria uma nova playlist
   */
  async createPlaylist(createPlaylistDto: CreatePlaylistDto): Promise<Playlist> {
    return prisma.playlist.create({
      data: {
        name: createPlaylistDto.name,
        description: createPlaylistDto.description,
      },
    });
  }

  /**
   * Lista todas as playlists
   */
  async getAllPlaylists(): Promise<(Playlist & { tracks: { track: RadioTrack; order: number }[] })[]> {
    const playlists = await prisma.playlist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      playlists.map(async (playlist) => {
        const tracks = await prisma.playlistTrack.findMany({
          where: { playlistId: playlist.id },
          include: { track: true },
          orderBy: { order: 'asc' },
        });
        return {
          ...playlist,
          tracks: tracks.map(pt => ({ track: pt.track, order: pt.order })),
        };
      })
    );
  }

  /**
   * Busca uma playlist por ID
   */
  async getPlaylistById(id: string): Promise<Playlist & { tracks: { track: RadioTrack; order: number }[] }> {
    const playlist = await prisma.playlist.findUnique({
      where: { id },
    });

    if (!playlist) {
      throw new HttpError(404, `Playlist with ID ${id} not found`, 'Not Found');
    }

    const tracks = await prisma.playlistTrack.findMany({
      where: { playlistId: id },
      include: { track: true },
      orderBy: { order: 'asc' },
    });

    return {
      ...playlist,
      tracks: tracks.map(pt => ({ track: pt.track, order: pt.order })),
    };
  }

  /**
   * Atualiza uma playlist
   */
  async updatePlaylist(id: string, updatePlaylistDto: UpdatePlaylistDto): Promise<Playlist> {
    await this.getPlaylistById(id);

    return prisma.playlist.update({
      where: { id },
      data: updatePlaylistDto,
    });
  }

  /**
   * Deleta uma playlist
   */
  async deletePlaylist(id: string): Promise<void> {
    await this.getPlaylistById(id);
    await prisma.playlist.delete({
      where: { id },
    });
  }

  /**
   * Adiciona uma música à playlist
   */
  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    await this.getPlaylistById(playlistId);
    await this.findTrackById(trackId);

    // Verifica se já existe
    const existing = await prisma.playlistTrack.findUnique({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
    });

    if (existing) {
      throw new HttpError(400, 'Track already in playlist', 'Bad Request');
    }

    // Obtém o próximo order
    const maxOrder = await prisma.playlistTrack.aggregate({
      where: { playlistId },
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    await prisma.playlistTrack.create({
      data: {
        playlistId,
        trackId,
        order: nextOrder,
      },
    });
  }

  /**
   * Remove uma música da playlist
   */
  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await prisma.playlistTrack.delete({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
    });
  }

  /**
   * Reordena as músicas da playlist
   */
  async reorderPlaylistTracks(playlistId: string, reorderDto: ReorderPlaylistTracksDto): Promise<void> {
    await this.getPlaylistById(playlistId);

    await Promise.all(
      reorderDto.tracks.map(({ trackId, order }) =>
        prisma.playlistTrack.update({
          where: {
            playlistId_trackId: {
              playlistId,
              trackId,
            },
          },
          data: { order },
        })
      )
    );
  }

  // ========== SCHEDULE METHODS ==========

  /**
   * Cria uma nova programação
   */
  async createSchedule(createScheduleDto: CreateScheduleDto): Promise<Schedule> {
    // Valida playlist
    const playlist = await this.getPlaylistById(createScheduleDto.playlistId);
    if (playlist.tracks.length === 0) {
      throw new HttpError(400, 'Playlist must have at least one track', 'Bad Request');
    }

    // Valida horários
    this.validateTimeRange(createScheduleDto.startTime, createScheduleDto.endTime);

    // Verifica sobreposição
    await this.checkScheduleOverlap(
      createScheduleDto.dayOfWeek,
      createScheduleDto.startTime,
      createScheduleDto.endTime,
      null
    );

    return prisma.schedule.create({
      data: {
        dayOfWeek: createScheduleDto.dayOfWeek,
        startTime: createScheduleDto.startTime,
        endTime: createScheduleDto.endTime,
        playlistId: createScheduleDto.playlistId,
        isActive: createScheduleDto.isActive ?? true,
      },
    });
  }

  /**
   * Lista todas as programações
   */
  async getAllSchedules(): Promise<(Schedule & { playlist: Playlist })[]> {
    return prisma.schedule.findMany({
      include: {
        playlist: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  /**
   * Busca uma programação por ID
   */
  async getScheduleById(id: string): Promise<Schedule & { playlist: Playlist }> {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: { playlist: true },
    });

    if (!schedule) {
      throw new HttpError(404, `Schedule with ID ${id} not found`, 'Not Found');
    }

    return schedule;
  }

  /**
   * Atualiza uma programação
   */
  async updateSchedule(id: string, updateScheduleDto: UpdateScheduleDto): Promise<Schedule> {
    const schedule = await this.getScheduleById(id);

    const data: any = {};

    if (updateScheduleDto.playlistId !== undefined) {
      const playlist = await this.getPlaylistById(updateScheduleDto.playlistId);
      if (playlist.tracks.length === 0) {
        throw new HttpError(400, 'Playlist must have at least one track', 'Bad Request');
      }
      data.playlistId = updateScheduleDto.playlistId;
    }

    if (updateScheduleDto.startTime !== undefined) {
      data.startTime = updateScheduleDto.startTime;
    }

    if (updateScheduleDto.endTime !== undefined) {
      data.endTime = updateScheduleDto.endTime;
    }

    if (updateScheduleDto.dayOfWeek !== undefined) {
      data.dayOfWeek = updateScheduleDto.dayOfWeek;
    }

    if (updateScheduleDto.isActive !== undefined) {
      data.isActive = updateScheduleDto.isActive;
    }

    // Valida horários se ambos foram fornecidos
    if (data.startTime && data.endTime) {
      this.validateTimeRange(data.startTime, data.endTime);
    } else if (data.startTime) {
      this.validateTimeRange(data.startTime, schedule.endTime);
    } else if (data.endTime) {
      this.validateTimeRange(schedule.startTime, data.endTime);
    }

    // Verifica sobreposição
    const finalStartTime = data.startTime ?? schedule.startTime;
    const finalEndTime = data.endTime ?? schedule.endTime;
    const finalDayOfWeek = data.dayOfWeek ?? schedule.dayOfWeek;

    await this.checkScheduleOverlap(finalDayOfWeek, finalStartTime, finalEndTime, id);

    return prisma.schedule.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta uma programação
   */
  async deleteSchedule(id: string): Promise<void> {
    await this.getScheduleById(id);
    await prisma.schedule.delete({
      where: { id },
    });
  }

  /**
   * Obtém a programação ativa no momento atual
   */
  async getCurrentSchedule(): Promise<(Schedule & { playlist: Playlist }) | null> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const schedules = await prisma.schedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
      },
      include: {
        playlist: true,
      },
    });

    // Encontra o schedule que está ativo no horário atual
    for (const schedule of schedules) {
      if (this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) {
        return schedule;
      }
    }

    return null;
  }

  /**
   * Valida se um horário está dentro de um range
   */
  isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeSeconds = this.timeStringToSeconds(time);
    const startSeconds = this.timeStringToSeconds(startTime);
    const endSeconds = this.timeStringToSeconds(endTime);

    if (startSeconds <= endSeconds) {
      // Horário normal (ex: 08:00 - 23:00)
      // Inclui o horário de início e exclui o horário de término (para que 23:00 não seja incluído se o schedule termina às 23:00)
      return timeSeconds >= startSeconds && timeSeconds < endSeconds;
    } else {
      // Horário que cruza meia-noite (ex: 22:00 - 02:00)
      return timeSeconds >= startSeconds || timeSeconds < endSeconds;
    }
  }

  /**
   * Valida range de horários
   */
  validateTimeRange(startTime: string, endTime: string): void {
    const start = this.timeStringToSeconds(startTime);
    const end = this.timeStringToSeconds(endTime);

    if (start === end) {
      throw new HttpError(400, 'Start time and end time cannot be the same', 'Bad Request');
    }
  }

  /**
   * Verifica se há sobreposição de schedules no mesmo dia
   */
  async checkScheduleOverlap(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeScheduleId: string | null
  ): Promise<void> {
    const schedules = await prisma.schedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
    });

    for (const schedule of schedules) {
      if (this.schedulesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
        throw new HttpError(400, `Schedule overlaps with existing schedule (${schedule.startTime} - ${schedule.endTime})`, 'Bad Request');
      }
    }
  }

  /**
   * Verifica se dois schedules se sobrepõem
   */
  schedulesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const start1Sec = this.timeStringToSeconds(start1);
    const end1Sec = this.timeStringToSeconds(end1);
    const start2Sec = this.timeStringToSeconds(start2);
    const end2Sec = this.timeStringToSeconds(end2);

    // Caso normal: nenhum cruza meia-noite
    if (start1Sec < end1Sec && start2Sec < end2Sec) {
      return !(end1Sec <= start2Sec || end2Sec <= start1Sec);
    }

    // Caso 1 cruza meia-noite
    if (start1Sec >= end1Sec && start2Sec < end2Sec) {
      return start2Sec < end1Sec || start2Sec >= start1Sec;
    }

    // Caso 2 cruza meia-noite
    if (start1Sec < end1Sec && start2Sec >= end2Sec) {
      return start1Sec < end2Sec || start1Sec >= start2Sec;
    }

    // Ambos cruzam meia-noite
    return true;
  }
}

export const radioService = new RadioService();
