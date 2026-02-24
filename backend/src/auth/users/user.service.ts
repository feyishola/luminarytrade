import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { publicKey } });
  }

  async findBySocial(provider: string, socialId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { socialProvider: provider, socialId } });
  }

  async createEmailUser(email: string, passwordHash: string): Promise<User> {
    const user = this.usersRepo.create({
      email,
      passwordHash,
      emailVerified: false,
      roles: ['user'],
      tier: 'free',
      isActive: true,
    });
    return this.usersRepo.save(user);
  }

  async createWalletUser(publicKey: string): Promise<User> {
    const user = this.usersRepo.create({
      publicKey,
      emailVerified: true,
      roles: ['user'],
      tier: 'free',
      isActive: true,
    });
    return this.usersRepo.save(user);
  }

  async createSocialUser(
    provider: string,
    socialId: string,
    email?: string,
  ): Promise<User> {
    const user = this.usersRepo.create({
      socialProvider: provider,
      socialId,
      email: email ?? null,
      emailVerified: true,
      roles: ['user'],
      tier: 'free',
      isActive: true,
    });
    return this.usersRepo.save(user);
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { emailVerified: true });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { lastLoginAt: new Date() });
  }

  async linkPublicKey(userId: string, publicKey: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { publicKey });
  }
}
