import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import util from 'util';
import { PowerStationAccessory } from './powerStationAccessory';
import { ElectricityWattAccessory } from './electricityWattAccessory';
import { TemperatureAccessory } from './temperatureAccessory';

import child_process from 'node:child_process';
const execPromise = util.promisify(child_process.exec);


export class HomebridgeGoodWeInverter implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loginResponseBody: any = {};
  private retry: any = {};

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

  // loadElectricityAccessory(inverterData, dataDigPa)

  // loadElectricityAccessory(powerStationId, powerStationData, dataDigPath, name, multiplier = 1): ElectricityWattAccessory {
  //   const uuid = this.api.hap.uuid.generate(`power_station_${powerStationId}_${dataDigPath.join()}`);
  //   const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
  //   let ret;

  //   if(existingAccessory) {
  //     this.log.info('found cached accessory', existingAccessory.displayName);
  //     ret = new ElectricityWattAccessory(this, existingAccessory);
  //   } else {
  //     this.log.info('found new accessory', name);
  //     const accessory = new this.api.platformAccessory(name, uuid);
  //     accessory.context.device = { data: powerStationData, dataDigPath: dataDigPath, id: powerStationId, name: name,
  //       multiplier: multiplier };
  //     ret = new ElectricityWattAccessory(this, accessory);
  //     this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  //   }
  //   return ret;
  // }

  loadElectricityAccessory(localInstanceConfig, instanceData, dataDigPath, name): ElectricityWattAccessory {
    const uuid = this.api.hap.uuid.generate(`local_instance_${localInstanceConfig.localIp}_${dataDigPath.join()}`);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    let ret;

    if(existingAccessory) {
      this.log.info('found cached accessory', existingAccessory.displayName);
      ret = new ElectricityWattAccessory(this, existingAccessory);
    } else {
      this.log.info('found new accessory', name);
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.device = { data: instanceData, dataDigPath: dataDigPath, id: localInstanceConfig.localIp, name: name };
      ret = new ElectricityWattAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    return ret;
  }

  loadTemperatureAccessory(localInstanceConfig, instanceData, dataDigPath, name): ElectricityWattAccessory {
    const uuid = this.api.hap.uuid.generate(`local_instance_${localInstanceConfig.localIp}_${dataDigPath.join()}`);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    let ret;

    if(existingAccessory) {
      this.log.info('found cached accessory', existingAccessory.displayName);
      ret = new TemperatureAccessory(this, existingAccessory);
    } else {
      this.log.info('found new accessory', name);
      const accessory = new this.api.platformAccessory(name, uuid);
      accessory.context.device = { data: instanceData, dataDigPath: dataDigPath, id: localInstanceConfig.localIp, name: name };
      ret = new TemperatureAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    return ret;
  }

  async lookupLocalInstance(localInstanceConfig) {
    const cmd = `${this.config.SFKLocation} cudp ${localInstanceConfig.localIp} ${localInstanceConfig.port} -listen -noerror ` +
      `-timeout=${localInstanceConfig.timeout} ${localInstanceConfig.options} -pure +xed "/[eol]//"`;
    this.log.debug('running cmd: ', cmd);
    let output = '';
    try {
      const { stdout, stderr } = await execPromise(cmd);
      this.log.debug('cmd:response:stdout', stdout);
      this.log.debug('cmd:response:stderr', stderr);
      output = stdout;
    } catch(e: any) {
      // NOTE: not sure why it raises an exception and exitcode == 1
      this.log.debug('cmd:error', e.stdout);
      output = e.stdout;
    }
    if (output === '[timeout]') {
      if(!this.retry[localInstanceConfig.localIp]) {
        this.retry[localInstanceConfig.localIp] = 0;
      }
      this.retry[localInstanceConfig.localIp]++;
      await this.sleep(10000, () => {
        this.log.debug('sleeping...');
      });
      return await this.lookupLocalInstance(localInstanceConfig);
    }

    // TODO: add error output here!
    return this.parseInverter(output);
  }

  parseInverter(output) {
    this.log.debug('parseInverter:output', output);
    const ret = { internalTemperature: 0, mode: '', generationToday: 0, power: 0 };
    const temperatureIndex = 174;
    const temperature = Number('0x' + output.substring(temperatureIndex, temperatureIndex + 4)) / 10;
    if(temperature && temperature > 0) {
      ret.internalTemperature = temperature;
    }

    const modeIndex = 126;
    const mode = Number('0x' + output.substring(modeIndex, modeIndex + 4));
    if(mode && mode > 0) {
      if(mode === 0) {
        ret.mode = 'working';
      } else if (mode === 1) {
        ret.mode = 'normal';
      } else if (mode === 2) {
        ret.mode = 'error';
      } else if (mode === 3) {
        ret.mode = 'check';
      }
    }

    // in kWh
    const generationTodayIndex = 186;
    const generationToday = Number('0x' + output.substring(generationTodayIndex, generationTodayIndex + 4)) * 100;
    if (generationToday > 0) {
      ret.generationToday = generationToday;
    }

    // power in watt
    const powerIndex = 122;
    const power = Number('0x' + output.substring(powerIndex, powerIndex + 4));
    if(power > 0) {
      ret.power = power;
    }

    return ret;
  }

  async discoverDevices() {

    for(const localInstanceConfig of this.config.localIps) {
      const accessories: PowerStationAccessory[] = [];
      const inverterData = await this.lookupLocalInstance(localInstanceConfig);
      if(this.config.showCurrentPowerLevel) {
        accessories.push(
          this.loadElectricityAccessory(localInstanceConfig, inverterData, ['power'], 'Current Production W'));
      }
      if(this.config.showDayTotal) {
        accessories.push(
          this.loadElectricityAccessory(localInstanceConfig, inverterData, ['generationToday'], 'Day Production Wh'));
      }
      if(this.config.showInternalTemperature) {
        accessories.push(
          this.loadTemperatureAccessory(localInstanceConfig, inverterData, ['internalTemperature'], 'Internal Temp C'));
      }
      this.fetchLocalInstanceUpdate(10000, localInstanceConfig, accessories);
    }
  }

  async fetchLocalInstanceUpdate(timeout: number, localInstanceConfig, accessories) {
    setInterval(async () => {
      const inverterData = await this.lookupLocalInstance(localInstanceConfig);
      this.log.debug(`fetchPowerStationUpdate local-instance: ${localInstanceConfig.localIp}:${localInstanceConfig.port} ` +
        `with # ${accessories.length} accessories`);
      for(const accessory of accessories) {
        accessory.update(inverterData);
      }
    }, timeout);
  }

  timeout(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms));
  }

  async sleep(timeout, fn, ...args) {
    await this.timeout(timeout);
    return fn(...args);
  }
}
