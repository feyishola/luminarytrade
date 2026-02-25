import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Saga, SagaData, SagaState } from './saga.base';
import { SagaPersistence } from './saga-manager.service';
import { SagaDataEntity } from './entities/saga-data.entity';

@Injectable()
export class TypeOrmSagaPersistence implements SagaPersistence {
  constructor(
    @InjectRepository(SagaDataEntity)
    private readonly sagaRepository: Repository<SagaDataEntity>,
  ) {}

  async save(sagaData: SagaData): Promise<void> {
    const entity = new SagaDataEntity();
    entity.id = sagaData.id;
    entity.sagaType = sagaData.sagaType;
    entity.state = sagaData.state;
    entity.currentStep = sagaData.currentStep;
    entity.data = sagaData.data;
    entity.createdAt = sagaData.createdAt;
    entity.updatedAt = sagaData.updatedAt;
    entity.error = sagaData.error;
    
    await this.sagaRepository.save(entity);
  }

  async load(sagaId: string): Promise<SagaData | null> {
    const entity = await this.sagaRepository.findOne({ where: { id: sagaId } });
    
    if (!entity) return null;
    
    return {
      id: entity.id,
      sagaType: entity.sagaType,
      state: entity.state,
      currentStep: entity.currentStep,
      data: entity.data,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      error: entity.error,
    };
  }

  async delete(sagaId: string): Promise<void> {
    await this.sagaRepository.delete({ id: sagaId });
  }

  async findByState(state: SagaState): Promise<SagaData[]> {
    const entities = await this.sagaRepository.find({ where: { state } });
    
    return entities.map(entity => ({
      id: entity.id,
      sagaType: entity.sagaType,
      state: entity.state,
      currentStep: entity.currentStep,
      data: entity.data,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      error: entity.error,
    }));
  }
}
