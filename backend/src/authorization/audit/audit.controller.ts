@Controller('admin/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getAuditLogs() {
    return this.auditService.findAll();
  }
}