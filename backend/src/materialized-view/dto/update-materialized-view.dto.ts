import { PartialType } from '@nestjs/mapped-types';
import { CreateMaterializedViewDto } from './create-materialized-view.dto';

export class UpdateMaterializedViewDto extends PartialType(CreateMaterializedViewDto) {}
