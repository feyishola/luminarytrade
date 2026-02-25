import { Controller, Post, Body } from '@nestjs/common';
import { OracleService } from './oracle.service';
import { UpdateOracleDto } from './dto/update-oracle.dto';
import { IOracleCRUD } from '../common/interfaces/controller-interfaces/oracle-controller.interfaces';

@Controller('oracle')
export class OracleCRUDController implements IOracleCRUD {
  constructor(private readonly oracleService: OracleService) {}

  @Post('update')
  async update(@Body() dto: UpdateOracleDto): Promise<any> {
    const result = await this.oracleService.updateSnapshot(dto);
    return { ok: true, ...result };
  }
}