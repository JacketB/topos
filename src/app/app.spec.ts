import { describe, it, expect } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('should create the app instance', () => {
    const app = new App();
    expect(app).toBeTruthy();
  });
});
