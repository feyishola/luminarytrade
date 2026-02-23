import { IsValidWalletAddressConstraint } from '../wallet-address.validator';
import { ValidationArguments } from 'class-validator';

describe('IsValidWalletAddressConstraint', () => {
    let validator: IsValidWalletAddressConstraint;

    beforeEach(() => {
        validator = new IsValidWalletAddressConstraint();
    });

    it('should validate a correct Ethereum address', () => {
        const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        expect(validator.validate(validAddress, {} as ValidationArguments)).toBe(true);
    });

    it('should validate a correct Ethereum address in lowercase', () => {
        const validAddress = '0x742d35cc6634c0532925a3b844bc454e4438f44e';
        expect(validator.validate(validAddress, {} as ValidationArguments)).toBe(true);
    });

    it('should fail for an invalid Ethereum address (too short)', () => {
        const invalidAddress = '0x123';
        expect(validator.validate(invalidAddress, {} as ValidationArguments)).toBe(false);
    });

    it('should fail for an invalid Ethereum address (not hex)', () => {
        const invalidAddress = '0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
        expect(validator.validate(invalidAddress, {} as ValidationArguments)).toBe(false);
    });

    it('should fail for non-string values', () => {
        expect(validator.validate(123, {} as ValidationArguments)).toBe(false);
        expect(validator.validate(null, {} as ValidationArguments)).toBe(false);
    });

    it('should return correct default message', () => {
        expect(validator.defaultMessage({} as ValidationArguments)).toBe('invalid wallet address format');
    });
    });

    import { IsValidWalletAddress } from '../wallet-address.validator';

    describe('IsValidWalletAddress Decorator', () => {
    it('should be a function', () => {
        expect(typeof IsValidWalletAddress).toBe('function');
    });

    it('should return a decorator function', () => {
        const decorator = IsValidWalletAddress();
        expect(typeof decorator).toBe('function');
    });

    it('should register decorator', () => {
        class TestDto {
        @IsValidWalletAddress()
        address: string;
        }
        const dto = new TestDto();
        expect(dto).toBeDefined();
    });
});
