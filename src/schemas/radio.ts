import { t } from 'elysia';

export const CreateTrackSchema = t.Object({
  title: t.String(),
  artist: t.String(),
  band: t.Optional(t.String()),
  album: t.Optional(t.String()),
  genre: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
  status: t.Optional(t.Union([t.Literal('ACTIVE'), t.Literal('ARCHIVED')])),
  priority: t.Optional(t.Number()),
});

export const UpdateTrackSchema = t.Partial(CreateTrackSchema);

export const ReorderPlaylistSchema = t.Object({
  tracks: t.Array(
    t.Object({
      id: t.String(),
      priority: t.Number(),
    }),
  ),
});

export const CreatePlaylistSchema = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
});

export const UpdatePlaylistSchema = t.Partial(CreatePlaylistSchema);

export const AddTrackToPlaylistSchema = t.Object({
  trackId: t.String(),
});

export const ReorderPlaylistTracksSchema = t.Object({
  tracks: t.Array(
    t.Object({
      trackId: t.String(),
      order: t.Number(),
    }),
  ),
});

export const CreateScheduleSchema = t.Object({
  dayOfWeek: t.Number({ minimum: 0, maximum: 6 }),
  startTime: t.String(),
  endTime: t.String(),
  playlistId: t.String(),
  isActive: t.Optional(t.Boolean()),
});

export const UpdateScheduleSchema = t.Partial(CreateScheduleSchema);

export type CreateTrackDto = typeof CreateTrackSchema.static;
export type UpdateTrackDto = typeof UpdateTrackSchema.static;
export type ReorderPlaylistDto = typeof ReorderPlaylistSchema.static;
export type CreatePlaylistDto = typeof CreatePlaylistSchema.static;
export type UpdatePlaylistDto = typeof UpdatePlaylistSchema.static;
export type AddTrackToPlaylistDto = typeof AddTrackToPlaylistSchema.static;
export type ReorderPlaylistTracksDto = typeof ReorderPlaylistTracksSchema.static;
export type CreateScheduleDto = typeof CreateScheduleSchema.static;
export type UpdateScheduleDto = typeof UpdateScheduleSchema.static;
