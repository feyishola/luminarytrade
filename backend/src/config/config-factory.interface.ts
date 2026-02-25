export interface IConfigFactory<T> {
  createConfig(): T;
}