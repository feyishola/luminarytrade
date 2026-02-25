/**
 * OracleLatestPrice - Child entity of OracleSnapshot aggregate.
 * Must ONLY be accessed/mutated through the OracleSnapshot aggregate root.
 */
export class OracleLatestPrice {
  private constructor(
    private readonly _feed: string,
    private _price: number,
    private _confidence: number,
    private _exponent: number,
    private _publishTime: Date,
  ) {}

  static create(
    feed: string,
    price: number,
    confidence: number,
    exponent: number,
    publishTime: Date,
  ): OracleLatestPrice {
    if (!feed || feed.trim() === '') {
      throw new Error('Feed identifier must not be empty');
    }
    if (price < 0) {
      throw new Error(`Price for feed ${feed} must be non-negative`);
    }
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Confidence for feed ${feed} must be between 0 and 1`);
    }
    return new OracleLatestPrice(feed, price, confidence, exponent, publishTime);
  }

  static reconstitute(data: {
    feed: string;
    price: number;
    confidence: number;
    exponent: number;
    publishTime: Date;
  }): OracleLatestPrice {
    return new OracleLatestPrice(
      data.feed,
      data.price,
      data.confidence,
      data.exponent,
      data.publishTime,
    );
  }

  get feed(): string { return this._feed; }
  get price(): number { return this._price; }
  get confidence(): number { return this._confidence; }
  get exponent(): number { return this._exponent; }
  get publishTime(): Date { return this._publishTime; }

  /** Adjusted price accounting for exponent */
  get adjustedPrice(): number {
    return this._price * Math.pow(10, this._exponent);
  }

  toPlain() {
    return {
      feed: this._feed,
      price: this._price,
      confidence: this._confidence,
      exponent: this._exponent,
      publishTime: this._publishTime,
    };
  }
}
