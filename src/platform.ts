import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
// import { ExamplePlatformAccessory } from './platformAccessory';

import request from 'request';
import util from 'util';
import { PowerStationAccessory } from './powerStationAccessory';
import { ElectricityWattAccessory } from './electricityWattAccessory';
import { TemperatureAccessory } from './temperatureAccessory';
const requestPromise = util.promisify(request);

export class HomebridgeSems implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private loginAttempts = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loginResponseBody: any = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  loadElectricityAccessory(powerStationId, powerStationData, dataDigPath, name, multiplier = 1): ElectricityWattAccessory {
    const uuid = this.api.hap.uuid.generate(`power_station_${powerStationId}_${dataDigPath.join()}`);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    let ret;

    if(existingAccessory) {
      this.log.info('found cached accessory', existingAccessory.displayName);
      ret = new ElectricityWattAccessory(this, existingAccessory);
    } else {
      this.log.info('found new accessory', name);
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.device = { data: powerStationData, dataDigPath: dataDigPath, id: powerStationId, name: name,
        multiplier: multiplier };
      ret = new ElectricityWattAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    return ret;
  }

  loadTemperatureAccessory(powerStationId, powerStationData, dataDigPath, name, multiplier = 1): ElectricityWattAccessory {
    const uuid = this.api.hap.uuid.generate(`power_station_${powerStationId}_${dataDigPath.join()}`);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    let ret;

    if(existingAccessory) {
      this.log.info('found cached accessory', existingAccessory.displayName);
      ret = new TemperatureAccessory(this, existingAccessory);
    } else {
      this.log.info('found new accessory', name);
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.device = { data: powerStationData, dataDigPath: dataDigPath, id: powerStationId, name: name,
        multiplier: multiplier };
      ret = new TemperatureAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    return ret;
  }

  async discoverDevices() {
    // iterate all configured power-stations
    for(const powerStationId of this.config.powerStationIds){
      // load power-station-data form API
      const powerStationData = await this.getPowerStationDataById(powerStationId);
      this.log.debug('powerStationData for:', powerStationId);
      const accessories: PowerStationAccessory[] = [];

      if(this.config.showCurrentPowerLevel) {
        accessories.push(
          this.loadElectricityAccessory(powerStationId, powerStationData, ['kpi', 'pac'], 'Current Production W', 1));
      }

      if(this.config.showDayTotal) {
        accessories.push(
          this.loadElectricityAccessory(powerStationId, powerStationData, ['kpi', 'power'], 'Day Production Wh', 1000));
      }

      if(this.config.showInternalTemperature) {
        // NOTE: tempperature is not a typo :-D
        accessories.push(
          this.loadTemperatureAccessory(powerStationId, powerStationData, ['inverter', 0, 'tempperature'], 'Internal Temperature', 1));
      }

      // update all accessories with new data
      this.fetchPowerStationUpdate(5000, powerStationId, accessories);
    }
  }

  async fetchPowerStationUpdate(timeout: number, powerStationId, accessories) {
    setInterval(async () => {
      const powerStationData = await this.getPowerStationDataById(powerStationId);
      this.log.debug('fetchPowerStationUpdate', powerStationId, accessories.length);
      for(const accessory of accessories) {
        accessory.update(powerStationData);
      }
    }, timeout);
  }

  async login() {
    if(this.loginResponseBody.data) {
      return;
    }
    this.loginAttempts++;

    const json = { account: this.config.email, pwd: this.config.password };
    const response = await requestPromise({ uri: `${this.config.hostname}/api/v2/Common/CrossLogin`, method: 'POST', json: json,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'token': '{"version":"","client":"ios","language":"en"}'},
      rejectUnauthorized: false, requestCert: true, resolveWithFullResponse: true });

    this.log.debug('login response: ', response.statusCode);
    if(response.statusCode === 200) {
      this.loginResponseBody = response.body;
      this.log.info('Login successful');
    } else {
      this.log.error('Authorization failed', response.statusCode);
      this.clearAuthenticationAndSleepAfterTooManyAttempts();
      return await this.login();
    }
  }

  async getPowerStationDataById(powerStationId) {
    await this.login();

    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json',
      'token': JSON.stringify(this.loginResponseBody.data)};
    const response = await requestPromise({ uri: `${this.loginResponseBody.api}v2/PowerStation/GetMonitorDetailByPowerstationId`,
      method: 'POST',
      json: { powerStationId: powerStationId },
      headers: headers,
      rejectUnauthorized: false, requestCert: true, resolveWithFullResponse: true });

    if (response.statusCode !== 200) {
      this.log.error('Data unexpected response: ', response.statusCode);
      await this.clearAuthenticationAndSleepAfterTooManyAttempts();
      return await this.getPowerStationDataById(powerStationId);
    } else {
      // this.log.debug('data response: ', response.statusCode, response.body);
    }
    return response.body.data;
  }

  timeout(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms));
  }

  async sleep(fn, ...args) {
    await this.timeout(5000);
    return fn(...args);
  }

  async clearAuthenticationAndSleepAfterTooManyAttempts() {
    this.loginResponseBody = {};
    // wait before trying again
    if(this.loginAttempts > 1) {
      this.log.info('Login attempt surpassing 1, sleeping for 5 second..');
      await this.sleep(() => {
        this.log.debug('sleeping...');
      });
    }
  }
}
