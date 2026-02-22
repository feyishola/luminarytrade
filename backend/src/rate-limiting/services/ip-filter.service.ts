import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { whitelistConfig, blacklistConfig } from '../config/rate-limit.config';

@Injectable()
export class IpFilterService {
  private whitelist: Set<string> = new Set(whitelistConfig.ips);
  private whitelistCidrs: string[] = whitelistConfig.cidrs;
  private blacklist: Set<string> = new Set(blacklistConfig.ips);
  private blacklistCidrs: string[] = blacklistConfig.cidrs;

  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {
    this.loadLists();
  }

  private async loadLists(): Promise<void> {
    // Load from cache if available
    const cachedWhitelist = await this.cache.get<string[]>('ipfilter:whitelist');
    const cachedBlacklist = await this.cache.get<string[]>('ipfilter:blacklist');

    if (cachedWhitelist) {
      this.whitelist = new Set(cachedWhitelist);
    }
    if (cachedBlacklist) {
      this.blacklist = new Set(cachedBlacklist);
    }
  }

  isWhitelisted(ip: string): boolean {
    if (this.whitelist.has(ip)) return true;
    return this.matchesCidr(ip, this.whitelistCidrs);
  }

  isBlacklisted(ip: string): boolean {
    if (this.blacklist.has(ip)) return true;
    return this.matchesCidr(ip, this.blacklistCidrs);
  }

  async addToWhitelist(ip: string): Promise<void> {
    this.whitelist.add(ip);
    await this.saveWhitelist();
  }

  async removeFromWhitelist(ip: string): Promise<void> {
    this.whitelist.delete(ip);
    await this.saveWhitelist();
  }

  async addToBlacklist(ip: string, reason?: string): Promise<void> {
    this.blacklist.add(ip);
    await this.saveBlacklist();

    if (reason) {
      await this.cache.set(`ipfilter:blacklist:reason:${ip}`, reason, 24 * 60 * 60 * 1000);
    }
  }

  async removeFromBlacklist(ip: string): Promise<void> {
    this.blacklist.delete(ip);
    await this.saveBlacklist();
    await this.cache.del(`ipfilter:blacklist:reason:${ip}`);
  }

  async recordViolation(ip: string): Promise<number> {
    const key = `ipfilter:violations:${ip}`;
    const current = await this.cache.get<number>(key) || 0;
    const newCount = current + 1;

    await this.cache.set(key, newCount, blacklistConfig.autoBlacklistWindowMs);

    // Auto-blacklist if threshold reached
    if (newCount >= blacklistConfig.autoBlacklistThreshold) {
      await this.addToBlacklist(ip, `Auto-blacklisted after ${newCount} violations`);
    }

    return newCount;
  }

  async getViolationCount(ip: string): Promise<number> {
    return this.cache.get<number>(`ipfilter:violations:${ip}`) || 0;
  }

  async clearViolations(ip: string): Promise<void> {
    await this.cache.del(`ipfilter:violations:${ip}`);
  }

  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  getBlacklist(): string[] {
    return Array.from(this.blacklist);
  }

  private async saveWhitelist(): Promise<void> {
    await this.cache.set('ipfilter:whitelist', Array.from(this.whitelist), 0);
  }

  private async saveBlacklist(): Promise<void> {
    await this.cache.set('ipfilter:blacklist', Array.from(this.blacklist), 0);
  }

  private matchesCidr(ip: string, cidrs: string[]): boolean {
    for (const cidr of cidrs) {
      if (this.isIpInCidr(ip, cidr)) {
        return true;
      }
    }
    return false;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits = '32'] = cidr.split('/');
    const mask = parseInt(bits, 10);

    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);

    if (ipParts.length !== 4 || rangeParts.length !== 4) {
      return false;
    }

    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];

    const maskBits = 0xFFFFFFFF << (32 - mask);

    return (ipNum & maskBits) === (rangeNum & maskBits);
  }
}
