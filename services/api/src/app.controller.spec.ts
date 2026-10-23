import 'reflect-metadata';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports healthy', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
