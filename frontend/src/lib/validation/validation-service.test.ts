import {
  ValidationService,
  required,
  email,
  minLength,
  maxLength,
  number,
  stellarAddress,
  ValidationErrorCode,
} from './index';

// Mock form data for testing
interface TestFormData {
  name: string;
  email: string;
  age: number;
  address: string;
}

describe('ValidationService', () => {
  describe('Individual Validators', () => {
    test('required validator', () => {
      const validator = required();
      expect(validator('test')).toEqual({ valid: true });
      expect(validator('')).toEqual({
        valid: false,
        code: ValidationErrorCode.REQUIRED,
        message: 'This field is required',
      });
      expect(validator(undefined as any)).toEqual({
        valid: false,
        code: ValidationErrorCode.REQUIRED,
        message: 'This field is required',
      });
      expect(validator(null as any)).toEqual({
        valid: false,
        code: ValidationErrorCode.REQUIRED,
        message: 'This field is required',
      });
    });

    test('email validator', () => {
      const validator = email();
      expect(validator('test@example.com')).toEqual({ valid: true });
      expect(validator('invalid-email')).toEqual({
        valid: false,
        code: ValidationErrorCode.EMAIL,
        message: 'Please enter a valid email address',
      });
      expect(validator('')).toEqual({ valid: true }); // Email is optional when empty
      expect(validator(undefined as any)).toEqual({ valid: true });
    });

    test('minLength validator', () => {
      const validator = minLength(5);
      expect(validator('hello')).toEqual({ valid: true });
      expect(validator('hi')).toEqual({
        valid: false,
        code: ValidationErrorCode.MIN_LENGTH,
        message: 'Must be at least 5 characters',
      });
      expect(validator('')).toEqual({ valid: true }); // Optional when empty
    });

    test('maxLength validator', () => {
      const validator = maxLength(5);
      expect(validator('hello')).toEqual({ valid: true });
      expect(validator('hello world')).toEqual({
        valid: false,
        code: ValidationErrorCode.MAX_LENGTH,
        message: 'Must be no more than 5 characters',
      });
      expect(validator('')).toEqual({ valid: true }); // Optional when empty
    });

    test('number validator', () => {
      const validator = number();
      expect(validator('123')).toEqual({ valid: true });
      expect(validator(456)).toEqual({ valid: true });
      expect(validator('abc')).toEqual({
        valid: false,
        code: ValidationErrorCode.NUMBER,
        message: 'Must be a valid number',
      });
      expect(validator('')).toEqual({ valid: true }); // Optional when empty
    });

    test('stellarAddress validator', () => {
      const validator = stellarAddress();
      // Valid Stellar public key
      const validPublicKey = 'GA7YNBW2ZHTVDD6NKGOUZTRNWVQJHYZXMXQDTF4VWWGS57EPLCA5NDLB';
      expect(validator(validPublicKey)).toEqual({ valid: true });
      
      // Invalid Stellar address
      expect(validator('invalid-address')).toEqual({
        valid: false,
        code: ValidationErrorCode.STELLAR_ADDRESS,
        message: 'Invalid Stellar address',
      });
      
      expect(validator('')).toEqual({ valid: true }); // Optional when empty
    });
  });

  describe('Validator Composition', () => {
    test('compose multiple validators (all must pass)', async () => {
      const composed = ValidationService.compose(
        required(),
        minLength(5),
        email(),
      );
      
      // Should fail because it's not an email
      const result1 = await composed('hello');
      expect(result1).toEqual({
        valid: false,
        code: ValidationErrorCode.EMAIL,
        message: 'Please enter a valid email address',
      });
      
      // Should pass all validations
      const result2 = await composed('hello@test.com');
      expect(result2).toEqual({ valid: true });
    });
  });

  describe('Form Validation', () => {
    test('validateForm with schema', async () => {
      const schema = ValidationService.createSchema<TestFormData>({
        name: {
          required: true,
          minLength: 3,
        },
        email: {
          required: true,
          email: true,
        },
        age: {
          number: true,
        },
        address: {
          minLength: 10,
        },
      });

      // Valid data
      const validData: TestFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        address: '123 Main Street',
      };
      
      const validErrors = await ValidationService.validateForm(validData, schema);
      expect(validErrors).toEqual({});

      // Invalid data
      const invalidData: TestFormData = {
        name: 'Jo', // Too short
        email: 'invalid-email', // Invalid email
        age: 30,
        address: 'Short', // Too short
      };
      
      const invalidErrors = await ValidationService.validateForm(invalidData, schema);
      
      expect(invalidErrors.name).toBeDefined();
      expect(invalidErrors.email).toBeDefined();
      expect(invalidErrors.address).toBeDefined();
      expect(invalidErrors.age).toBeUndefined(); // Age is valid
    });

    test('conditional validation', async () => {
      interface FormDataWithCondition {
        country: string;
        postalCode: string;
      }

      const schema = ValidationService.createSchema<FormDataWithCondition>({
        country: {
          required: true,
        },
        postalCode: {
          required: (formData: FormDataWithCondition) => formData.country === 'US',
        },
      });

      // Should not require postal code for non-US
      const nonUSData: FormDataWithCondition = {
        country: 'CA',
        postalCode: '',
      };
      const nonUSErrors = await ValidationService.validateForm(nonUSData, schema);
      expect(nonUSErrors.postalCode).toBeUndefined();

      // Should require postal code for US
      const usData: FormDataWithCondition = {
        country: 'US',
        postalCode: '',
      };
      const usErrors = await ValidationService.validateForm(usData, schema);
      expect(usErrors.postalCode).toBeDefined();
    });
  });

  describe('Schema Creation', () => {
    test('createSchema with various validation rules', () => {
      const schema = ValidationService.createSchema<TestFormData>({
        name: {
          required: true,
          minLength: { value: 2, message: 'Name must be at least 2 characters' },
          maxLength: { value: 50, message: 'Name must be no more than 50 characters' },
        },
        email: {
          required: true,
          email: true,
        },
        age: {
          min: { value: 18, message: 'Must be at least 18 years old' },
          max: { value: 100, message: 'Must be no more than 100 years old' },
          number: true,
        },
        address: {
          minLength: 5,
        },
      });

      expect(schema.name).toBeDefined();
      expect(schema.email).toBeDefined();
      expect(schema.age).toBeDefined();
      expect(schema.address).toBeDefined();
    });
  });

  describe('Async Validation', () => {
    test('should handle async validators', async () => {
      // Mock async validator
      const mockAsyncValidator = jest.fn().mockResolvedValue({ valid: true });
      
      const schema = ValidationService.createSchema<TestFormData>({
        email: {
          required: true,
          email: true,
          async: [mockAsyncValidator],
        },
      });

      const testData: TestFormData = {
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        address: '123 Main St',
      };

      const errors = await ValidationService.validateForm(testData, schema);
      expect(mockAsyncValidator).toHaveBeenCalledWith('test@example.com', testData, 'email');
      expect(errors).toEqual({});
    });
  });

  describe('Helper Functions', () => {
    test('createFormValidator creates reusable validator', async () => {
      const schema = ValidationService.createSchema<TestFormData>({
        name: { required: true },
        email: { required: true, email: true },
      });

      const validator = createFormValidator(schema);
      
      const validData: TestFormData = {
        name: 'John',
        email: 'john@example.com',
        age: 30,
        address: '123 Main St',
      };
      
      const validErrors = await validator(validData);
      expect(validErrors).toEqual({});

      const invalidData: TestFormData = {
        name: '',
        email: 'invalid-email',
        age: 30,
        address: '123 Main St',
      };
      
      const invalidErrors = await validator(invalidData);
      expect(invalidErrors.name).toBeDefined();
      expect(invalidErrors.email).toBeDefined();
    });
  });
});
