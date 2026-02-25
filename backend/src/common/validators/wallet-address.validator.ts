import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@ValidatorConstraint({ name: 'isValidWalletAddress', async: false })
@Injectable()
export class IsValidWalletAddressConstraint implements ValidatorConstraintInterface {
    validate(address: any, args: ValidationArguments) {
        if (typeof address !== 'string') return false;
        try {
        return ethers.utils.isAddress(address);
        } catch {
        return false;
        }
    }

    defaultMessage(args: ValidationArguments) {
        return 'invalid wallet address format';
    }
}

export function IsValidWalletAddress(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [],
        validator: IsValidWalletAddressConstraint,
        });
    };
}
