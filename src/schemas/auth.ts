import { t } from 'elysia';

export const LoginSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String(),
});

export const RegisterSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 }),
  name: t.String(),
  role: t.Optional(t.Union([t.Literal('USER'), t.Literal('ADMIN'), t.Literal('BAND')])),
});

export const GoogleExchangeSchema = t.Object({
  code: t.String({ minLength: 1 }),
});

export const ChangePasswordSchema = t.Object({
  current_password: t.Optional(t.String()),
  new_password: t.String({ minLength: 6 }),
  confirm_password: t.String({ minLength: 6 }),
});

export const UpdateProfileSchema = t.Object({
  name: t.Optional(t.String()),
  email: t.Optional(t.String({ format: 'email' })),
  avatar: t.Optional(t.String()),
});

export const UpdateNotificationsSchema = t.Object({
  emailNotifications: t.Optional(t.Boolean()),
  pushNotifications: t.Optional(t.Boolean()),
  oneSignalPlayerId: t.Optional(t.String()),
});

export type LoginDto = typeof LoginSchema.static;
export type RegisterDto = typeof RegisterSchema.static;
export type GoogleExchangeDto = typeof GoogleExchangeSchema.static;
export type ChangePasswordDto = typeof ChangePasswordSchema.static;
export type UpdateProfileDto = typeof UpdateProfileSchema.static;
export type UpdateNotificationsDto = typeof UpdateNotificationsSchema.static;
