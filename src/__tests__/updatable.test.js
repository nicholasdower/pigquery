import { describe, test, expect, jest } from '@jest/globals';
import Updatable from '../updatable.js';

describe('Updatable', () => {
  describe('Datenzugriff via Proxy', () => {
    test('sollte Eigenschaften des initialen Datenobjekts durchreichen', () => {
      const updatable = new Updatable({ items: [1, 2, 3], hasError: false });

      expect(updatable.items).toEqual([1, 2, 3]);
      expect(updatable.hasError).toBe(false);
    });

    test('sollte undefined zurückgeben für nicht vorhandene Eigenschaften', () => {
      const updatable = new Updatable({ items: [] });

      expect(updatable.nonExistent).toBeUndefined();
    });

    test('sollte mit null als initialem Datenwert umgehen', () => {
      const updatable = new Updatable(null);

      expect(updatable.items).toBeUndefined();
    });

    test('sollte eigene Methoden bevorzugt gegenüber Dateneigenschaften', () => {
      const updatable = new Updatable({ update: 'ich bin Daten, keine Methode' });

      expect(typeof updatable.update).toBe('function');
    });
  });

  describe('update()', () => {
    test('sollte die internen Daten ersetzen', () => {
      const updatable = new Updatable({ items: [] });

      updatable.update({ items: [42], hasError: true });

      expect(updatable.items).toEqual([42]);
      expect(updatable.hasError).toBe(true);
    });

    test('sollte alle registrierten Listener benachrichtigen', () => {
      const updatable = new Updatable({ items: [] });
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      updatable.addListener(listener1);
      updatable.addListener(listener2);
      updatable.update({ items: [1] });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    test('sollte Listener auch mehrfach aufrufen bei mehreren Updates', () => {
      const updatable = new Updatable({ items: [] });
      const listener = jest.fn();

      updatable.addListener(listener);
      updatable.update({ items: [1] });
      updatable.update({ items: [2] });
      updatable.update({ items: [3] });

      expect(listener).toHaveBeenCalledTimes(3);
    });

    test('sollte keine Listener aufrufen wenn keine registriert sind', () => {
      const updatable = new Updatable({ items: [] });

      expect(() => updatable.update({ items: [1] })).not.toThrow();
    });
  });

  describe('addListener()', () => {
    test('sollte denselben Listener mehrfach hinzufügen können', () => {
      const updatable = new Updatable({ items: [] });
      const listener = jest.fn();

      updatable.addListener(listener);
      updatable.addListener(listener);
      updatable.update({ items: [1] });

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeListener()', () => {
    test('sollte einen Listener entfernen, sodass er nicht mehr aufgerufen wird', () => {
      const updatable = new Updatable({ items: [] });
      const listener = jest.fn();

      updatable.addListener(listener);
      updatable.removeListener(listener);
      updatable.update({ items: [1] });

      expect(listener).not.toHaveBeenCalled();
    });

    test('sollte alle Instanzen entfernen wenn derselbe Listener mehrfach registriert ist', () => {
      const updatable = new Updatable({ items: [] });
      const listener = jest.fn();

      updatable.addListener(listener);
      updatable.addListener(listener);
      updatable.removeListener(listener);
      updatable.update({ items: [1] });

      expect(listener).not.toHaveBeenCalled();
    });

    test('sollte nichts tun wenn der Listener nicht registriert ist', () => {
      const updatable = new Updatable({ items: [] });
      const listener = jest.fn();

      expect(() => updatable.removeListener(listener)).not.toThrow();

      updatable.update({ items: [1] });
      expect(listener).not.toHaveBeenCalled();
    });

    test('sollte andere Listener nicht beeinflussen beim Entfernen', () => {
      const updatable = new Updatable({ items: [] });
      const listenerA = jest.fn();
      const listenerB = jest.fn();

      updatable.addListener(listenerA);
      updatable.addListener(listenerB);
      updatable.removeListener(listenerA);
      updatable.update({ items: [1] });

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledTimes(1);
    });
  });
});
