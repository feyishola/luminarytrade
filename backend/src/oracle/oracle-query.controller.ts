import { Controller, Get } from '@nestjs/common';
import { OracleService } from './oracle.service';
import { FeedPrice } from './oracle.service';
import { IOracleQuery } from '../common/interfaces/controller-interfaces/oracle-controller.interfaces';

@Controller('oracle')
export class OracleQueryController implements IOracleQuery {
  constructor(private readonly oracleService: OracleService) {}

  @Get('latest')
  async latest(): Promise<{ ok: boolean; values: FeedPrice[] }> {
    const values = await this.oracleService.getLatest();
    return { ok: true, values };
  }
}