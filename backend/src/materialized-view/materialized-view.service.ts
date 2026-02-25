import { Injectable } from '@nestjs/common';
import { CreateMaterializedViewDto } from './dto/create-materialized-view.dto';
import { UpdateMaterializedViewDto } from './dto/update-materialized-view.dto';

@Injectable()
export class MaterializedViewService {
  create(createMaterializedViewDto: CreateMaterializedViewDto) {
    return 'This action adds a new materializedView';
  }

  findAll() {
    return `This action returns all materializedView`;
  }

  findOne(id: number) {
    return `This action returns a #${id} materializedView`;
  }

  update(id: number, updateMaterializedViewDto: UpdateMaterializedViewDto) {
    return `This action updates a #${id} materializedView`;
  }

  remove(id: number) {
    return `This action removes a #${id} materializedView`;
  }
}
