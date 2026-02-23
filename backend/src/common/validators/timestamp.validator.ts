import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'isValidTimestamp', async: false })
@Injectable()
export class IsValidTimestampConstraint implements ValidatorConstraintInterface {
    private readonly maxClockSkewMs: number;

    constructor() {
        this.maxClockSkewMs = parseInt(process.env.ORACLE_MAX_CLOCK_SKEW_MS || '120000', 10);
    }

    validate(ts: any, args: ValidationArguments) {
        if (typeof ts !== 'number') return false;
        
        const tMs = ts > 1e12 ? ts : ts * 1000;
        const now = Date.now();
        return Math.abs(now - tMs) <= this.maxClockSkewMs;
    }

    defaultMessage(args: ValidationArguments) {
        return 'timestamp out of allowed skew';
    }
}

export function IsValidTimestamp(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [],
        validator: IsValidTimestampConstraint,
        });
    };
}