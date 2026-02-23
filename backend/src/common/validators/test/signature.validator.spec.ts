import { IsValidSignatureConstraint } from '../signature.validator';
import { ValidationArguments } from 'class-validator';
import { verifySignature } from '../../../oracle/utils/signature.utils';

jest.mock('../../../oracle/utils/signature.utils');

describe('IsValidSignatureConstraint', () => {
    let validator: IsValidSignatureConstraint;
    const mockVerifySignature = verifySignature as jest.MockedFunction<typeof verifySignature>;

    beforeEach(() => {
        validator = new IsValidSignatureConstraint();
        jest.clearAllMocks();
    });

    it('should validate a correct signature', async () => {
        const dto = {
        timestamp: Date.now(),
        feeds: [{ pair: 'BTC/USD', price: '50000', decimals: 8 }],
        };
        const signature = '0xvalid_signature';
        const recoveredAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        
        mockVerifySignature.mockResolvedValue(recoveredAddress);

        const result = await validator.validate(signature, {
        object: dto,
        } as ValidationArguments);

        expect(result).toBe(true);
        expect(mockVerifySignature).toHaveBeenCalledWith(signature, dto.timestamp, dto.feeds);
    });

    it('should fail if signer is provided and does not match recovered address', async () => {
        const dto = {
        timestamp: Date.now(),
        feeds: [{ pair: 'BTC/USD', price: '50000', decimals: 8 }],
        signer: '0xexpected_signer',
        };
        const signature = '0xvalid_signature';
        const recoveredAddress = '0xdifferent_signer';
        
        mockVerifySignature.mockResolvedValue(recoveredAddress);

        const result = await validator.validate(signature, {
        object: dto,
        } as ValidationArguments);

        expect(result).toBe(false);
    });

    it('should fail if verifySignature throws an error', async () => {
    const dto = {
        timestamp: Date.now(),
        feeds: [{ pair: 'BTC/USD', price: '50000', decimals: 8 }],
    };
    const signature = '0xinvalid_signature';
    
    mockVerifySignature.mockRejectedValue(new Error('Invalid signature'));

    const result = await validator.validate(signature, {
        object: dto,
        } as ValidationArguments);

        expect(result).toBe(false);
    });

    it('should fail if timestamp or feeds are missing from DTO', async () => {
        const dto = {
        // missing timestamp and feeds
        };
        const signature = '0xany_signature';

        const result = await validator.validate(signature, {
        object: dto,
        } as ValidationArguments);

        expect(result).toBe(false);
    });

    it('should fail if signature is not a string', async () => {
        const dto = {
        timestamp: Date.now(),
        feeds: [{ pair: 'BTC/USD', price: '50000', decimals: 8 }],
        };
        const result = await validator.validate(123, {
        object: dto,
        } as ValidationArguments);
        expect(result).toBe(false);
    });

    it('should fail if global oracle signer is configured and does not match', async () => {
        // Manually set env for test
        process.env.ORACLE_SIGNER_ADDRESS = '0xexpected_global_signer';
        const validatorWithEnv = new IsValidSignatureConstraint();
        
        const dto = {
        timestamp: Date.now(),
        feeds: [{ pair: 'BTC/USD', price: '50000', decimals: 8 }],
        };
        mockVerifySignature.mockResolvedValue('0xdifferent_signer');

        const result = await validatorWithEnv.validate('0xsig', {
        object: dto,
        } as ValidationArguments);

        expect(result).toBe(false);
        delete process.env.ORACLE_SIGNER_ADDRESS;
    });

    it('should return correct default message', () => {
        expect(validator.defaultMessage({} as ValidationArguments)).toBe('invalid signature or signer mismatch');
    });
});

import { IsValidSignature } from '../signature.validator';

describe('IsValidSignature Decorator', () => {
    it('should be a function', () => {
        expect(typeof IsValidSignature).toBe('function');
    });

    it('should return a decorator function', () => {
        const decorator = IsValidSignature();
        expect(typeof decorator).toBe('function');
    });

    it('should register decorator', () => {
        class TestDto {
        @IsValidSignature()
        signature: string;
        }
        const dto = new TestDto();
        expect(dto).toBeDefined();
    });
});
