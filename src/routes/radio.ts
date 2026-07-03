import { Elysia, t } from 'elysia';
import { radioService } from '../services/radio.service';
import { adminPlugin } from '../plugins/admin';
import { toUploadFile } from '../lib/upload-file';
import {
  CreateTrackSchema,
  UpdateTrackSchema,
  ReorderPlaylistSchema,
  CreatePlaylistSchema,
  UpdatePlaylistSchema,
  AddTrackToPlaylistSchema,
  ReorderPlaylistTracksSchema,
  CreateScheduleSchema,
  UpdateScheduleSchema,
} from '../schemas/radio';

export const radioRoutes = new Elysia({ tags: ['radio', 'radio-admin'] })
  .group('/radio', (app) =>
    app
      .get('/current-track-url', async () => {
        const result = await radioService.getCurrentTrackUrl();
        if (!result) return { url: null, track: null };
        return { url: result.url, track: result.track };
      })
      .get('/status', () => radioService.getStatus())
      .get('/current', async () => ({ track: await radioService.getCurrentTrack() })),
  )
  .group('/radio/admin', (app) =>
    app
      .use(adminPlugin)
      .post(
        '/tracks',
        async ({ user, body }) => {
          const file = await toUploadFile(body.file);
          return radioService.addTrack(
            {
              title: body.title,
              artist: body.artist,
              band: body.band,
              album: body.album,
              genre: body.genre,
              duration: body.duration !== undefined ? Number(body.duration) : undefined,
              status: body.status,
              priority: body.priority !== undefined ? Number(body.priority) : undefined,
            },
            file,
            user!.id,
          );
        },
        {
          requireAdmin: true,
          body: t.Object({
            file: t.File(),
            title: t.String(),
            artist: t.String(),
            band: t.Optional(t.String()),
            album: t.Optional(t.String()),
            genre: t.Optional(t.String()),
            duration: t.Optional(t.Union([t.Number(), t.String()])),
            status: t.Optional(t.Union([t.Literal('ACTIVE'), t.Literal('ARCHIVED')])),
            priority: t.Optional(t.Union([t.Number(), t.String()])),
          }),
        },
      )
      .get('/tracks', () => radioService.findAllTracks(), { requireAdmin: true })
      .get('/tracks/:id', ({ params }) => radioService.findTrackById(params.id), {
        requireAdmin: true,
      })
      .put(
        '/tracks/:id',
        ({ params, body }) => radioService.updateTrack(params.id, body),
        { body: UpdateTrackSchema, requireAdmin: true },
      )
      .delete('/tracks/:id', async ({ params }) => {
        await radioService.removeTrack(params.id);
        return { message: 'Track deleted successfully' };
      }, { requireAdmin: true })
      .post(
        '/tracks/reorder',
        async ({ body }) => {
          await radioService.reorderPlaylist(body.tracks);
          return { message: 'Playlist reordered successfully' };
        },
        { body: ReorderPlaylistSchema, requireAdmin: true },
      )
      .post('/play', async () => {
        await radioService.startBroadcast();
        return { message: 'Radio started' };
      }, { requireAdmin: true })
      .post('/pause', async () => {
        await radioService.pauseBroadcast();
        return { message: 'Radio paused' };
      }, { requireAdmin: true })
      .get('/stats', () => radioService.getStats(), { requireAdmin: true })
      .post(
        '/playlists',
        ({ body }) => radioService.createPlaylist(body),
        { body: CreatePlaylistSchema, requireAdmin: true },
      )
      .get('/playlists', () => radioService.getAllPlaylists(), { requireAdmin: true })
      .get('/playlists/:id', ({ params }) => radioService.getPlaylistById(params.id), {
        requireAdmin: true,
      })
      .put(
        '/playlists/:id',
        ({ params, body }) => radioService.updatePlaylist(params.id, body),
        { body: UpdatePlaylistSchema, requireAdmin: true },
      )
      .delete('/playlists/:id', async ({ params }) => {
        await radioService.deletePlaylist(params.id);
        return { message: 'Playlist deleted successfully' };
      }, { requireAdmin: true })
      .post(
        '/playlists/:id/tracks',
        async ({ params, body }) => {
          await radioService.addTrackToPlaylist(params.id, body.trackId);
          return { message: 'Track added to playlist successfully' };
        },
        { body: AddTrackToPlaylistSchema, requireAdmin: true },
      )
      .delete('/playlists/:id/tracks/:trackId', async ({ params }) => {
        await radioService.removeTrackFromPlaylist(params.id, params.trackId);
        return { message: 'Track removed from playlist successfully' };
      }, { requireAdmin: true })
      .put(
        '/playlists/:id/tracks/reorder',
        async ({ params, body }) => {
          await radioService.reorderPlaylistTracks(params.id, body);
          return { message: 'Playlist tracks reordered successfully' };
        },
        { body: ReorderPlaylistTracksSchema, requireAdmin: true },
      )
      .post(
        '/schedules',
        ({ body }) => radioService.createSchedule(body),
        { body: CreateScheduleSchema, requireAdmin: true },
      )
      .get('/schedules', () => radioService.getAllSchedules(), { requireAdmin: true })
      .get('/schedules/:id', ({ params }) => radioService.getScheduleById(params.id), {
        requireAdmin: true,
      })
      .put(
        '/schedules/:id',
        ({ params, body }) => radioService.updateSchedule(params.id, body),
        { body: UpdateScheduleSchema, requireAdmin: true },
      )
      .delete('/schedules/:id', async ({ params }) => {
        await radioService.deleteSchedule(params.id);
        return { message: 'Schedule deleted successfully' };
      }, { requireAdmin: true }),
  );
