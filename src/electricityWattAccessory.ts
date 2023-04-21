import { Service, PlatformAccessory } from 'homebridge';
import { HomebridgeGoodWeInverter } from './platform';
import { PowerStationAccessory } from './powerStationAccessory';
import { dig } from 'dig-ts';


export class ElectricityWattAccessory extends PowerStationAccessory {
  private service: Service;

  constructor(
    private readonly platform: HomebridgeGoodWeInverter,
    private readonly accessory: PlatformAccessory,
  ) {
    super();
    // set accessory information TODO: add model and serialnumber!
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'GoodWe')
      .setCharacteristic(this.platform.Characteristic.Model, 'model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'sn');

    this.service = this.accessory.getService(this.platform.Service.LightSensor) ||
      this.accessory.addService(this.platform.Service.LightSensor);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
    // accessory.context.device = { data: instanceData, dataDigPath: dataDigPath, id: instanceData.localIp, name: name };

    this.update(accessory.context.device.data);
  }

  async update(powerStationData) {
    const value = dig(powerStationData, this.accessory.context.device.dataDigPath).get() as number;
    this.setValue(value);
  }

  setValue(value) {
    this.platform.log.info('New value', this.accessory.context.device.name, value);
    if(value < 0.0001) {
      value = 0.0001;
    } else if (value > 100000) {
      value = 100000;
    }
    this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel).updateValue(value);
  }
}
