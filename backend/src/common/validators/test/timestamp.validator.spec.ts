import { IsValidTimestampConstraint } from '../timestamp.validator';
import { ValidationArguments } from 'class-validator';

describe('IsValidTimestampConstraint', () => {
    let validator: IsValidTimestampConstraint;

    beforeEach(() => {
        validator = new IsValidTimestampConstraint();
    });

    it('should validate a correct timestamp within skew', () => {
        const now = Date.now();
        expect(validator.validate(now, {} as ValidationArguments)).toBe(true);
    });

    it('should validate a correct timestamp in seconds within skew', () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        expect(validator.validate(nowSeconds, {} as ValidationArguments)).toBe(true);
    });

    it('should fail for a timestamp outside skew (too old)', () => {
        const old = Date.now() - 1000000; // 1000s ago, default skew is 120s
        expect(validator.validate(old, {} as ValidationArguments)).toBe(false);
    });

    it('should fail for a timestamp outside skew (too new)', () => {
        const future = Date.now() + 1000000;
        expect(validator.validate(future, {} as ValidationArguments)).toBe(false);
    });

    it('should validate a timestamp in milliseconds', () => {
        const nowMs = Date.now();
        expect(validator.validate(nowMs, {} as ValidationArguments)).toBe(true);
    });

    it('should fail for non-number values', () => {
        expect(validator.validate('2023-01-01', {} as ValidationArguments)).toBe(false);
        expect(validator.validate(null, {} as ValidationArguments)).toBe(false);
    });

    it('should return correct default message', () => {
        expect(validator.defaultMessage({} as ValidationArguments)).toBe('timestamp out of allowed skew');
    });
    });

    import { IsValidTimestamp } from '../timestamp.validator';

    describe('IsValidTimestamp Decorator', () => {
    it('should be a function', () => {
        expect(typeof IsValidTimestamp).toBe('function');
    });

    it('should return a decorator function', () => {
        const decorator = IsValidTimestamp();
        expect(typeof decorator).toBe('function');
    });

    it('should register decorator', () => {
        class TestDto {
        @IsValidTimestamp()
        timestamp: number;
        }
        const dto = new TestDto();
        expect(dto).toBeDefined();
    });
});
