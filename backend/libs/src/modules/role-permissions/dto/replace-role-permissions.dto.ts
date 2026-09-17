import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @Transform(({ value }: TransformFnParams) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  permissionIds: string[];
}