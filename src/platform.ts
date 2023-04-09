import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
// import { ExamplePlatformAccessory } from './platformAccessory';

import request from 'request';
import util from 'util';
const requestPromise = util.promisify(request);

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomeBridgeSems implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private loginAttempts = 0;
  private loginResponseBody: any = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    this.log.debug('test');
    for(const powerStationId of this.config.powerStationIds){
      const powerStationData = await this.getPowerStationDataById(powerStationId);
      this.log.debug(`powerStationData for: ${powerStationId}`, powerStationData);

      // TODO: implement current incoming: powerStationData.soc.power for generated in kW?a
      // TODO: implement total per day: powerStationData.kpi.power for day total in kW
    }
  }

  async login() {
    this.loginAttempts++;

    const json = { account: this.config.email, pwd: this.config.password };
    const response = await requestPromise({ uri: `${this.config.hostname}/api/v2/Common/CrossLogin`, method: 'POST', json: json,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'token': '{"version":"","client":"ios","language":"en"}'},
      rejectUnauthorized: false, requestCert: true, resolveWithFullResponse: true });

    this.log.debug('login response: ', response.statusCode);
    if(response.statusCode === 200) {
      this.log.debug('login response: ', response.body);
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
      this.log.debug('data response: ', response.statusCode, response.body);
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

  async haltOnConfigError(errorMessage) {
    this.log.info(`Configuration error: ${errorMessage}`);
    await this.sleep(() => {
      this.log.debug('sleeping...');
    });
  }
}
