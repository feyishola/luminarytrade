import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { verifySignature } from '../../oracle/utils/signature.utils';

@ValidatorConstraint({ name: 'isValidSignature', async: true })
@Injectable()
export class IsValidSignatureConstraint implements ValidatorConstraintInterface {
    private readonly oracleSignerAddress: string;

    constructor() {
        this.oracleSignerAddress = process.env.ORACLE_SIGNER_ADDRESS;
    }

    async validate(signature: any, args: ValidationArguments) {
        const dto = args.object as any;
        if (!dto.timestamp || !dto.feeds || typeof signature !== 'string') {
        return false;
        }

        try {
        const recovered = await verifySignature(signature, dto.timestamp, dto.feeds);
        
        // If signer is provided in DTO, it must match recovered
        if (dto.signer && recovered.toLowerCase() !== dto.signer.toLowerCase()) {
            return false;
        }

        // If global oracle signer is configured, it must match recovered
        if (this.oracleSignerAddress && recovered.toLowerCase() !== this.oracleSignerAddress.toLowerCase()) {
            return false;
        }

        return true;
        } catch (error) {
        return false;
        }
    }

    defaultMessage(args: ValidationArguments) {
        return 'invalid signature or signer mismatch';
    }
}

export function IsValidSignature(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [],
        validator: IsValidSignatureConstraint,
        });
    };
}
