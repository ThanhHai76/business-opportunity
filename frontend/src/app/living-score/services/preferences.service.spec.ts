import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  beforeEach(() => localStorage.removeItem('hls.weights'));
  afterEach(() => localStorage.removeItem('hls.weights'));

  function create(): PreferencesService {
    TestBed.resetTestingModule();
    return TestBed.inject(PreferencesService);
  }

  it('drops criteria saved by older versions (safety, environment, cost)', () => {
    localStorage.setItem('hls.weights', JSON.stringify({ transportation: 30, safety: 10, cost: 5 }));
    expect(create().weights()).toEqual({ transportation: 30 });
  });

  it('forgets a saved set that only held removed criteria', () => {
    localStorage.setItem('hls.weights', JSON.stringify({ safety: 10, environment: 10 }));
    expect(create().weights()).toBeNull();
  });

  it('shows shared weights without overwriting the user own ones', () => {
    const prefs = create();
    prefs.setWeights({ education: 50 });
    prefs.viewShared('transportation:40,greenSpace:20');
    expect(prefs.weights()).toEqual({ transportation: 40, greenSpace: 20 });
    expect(prefs.myWeights()).toEqual({ education: 50 });
    prefs.dismissShared();
    expect(prefs.weights()).toEqual({ education: 50 });
  });

  it('adopts shared weights as the user own when asked', () => {
    const prefs = create();
    prefs.viewShared('amenities:70');
    prefs.adoptShared();
    expect(prefs.sharedWeights()).toBeNull();
    expect(prefs.myWeights()).toEqual({ amenities: 70 });
    expect(JSON.parse(localStorage.getItem('hls.weights')!)).toEqual({ amenities: 70 });
  });

  it('ignores malformed or empty shared weights', () => {
    const prefs = create();
    prefs.viewShared('safety:50,transportation:abc,education:900');
    expect(prefs.sharedWeights()).toBeNull();
    prefs.viewShared('transportation:0');
    expect(prefs.sharedWeights()).toBeNull();
  });
});
