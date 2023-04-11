import { Service, PlatformAccessory } from 'homebridge';
import { HomebridgeSems } from './platform';
import { PowerStationAccessory } from './powerStationAccessory';
import { dig } from 'dig-ts';


export class ElectricityWattAccessory extends PowerStationAccessory {
  private service: Service;

  constructor(
    private readonly platform: HomebridgeSems,
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

    this.update(accessory.context.device.data);
  }

  async update(powerStationData) {
    let value = dig(powerStationData, this.accessory.context.device.dataDigPath).get() as number;
    const multiplier = this.accessory.context.device.multiplier;
    if(multiplier) {
      value = value * multiplier;
    }
    this.setValue(value);
  }

  setValue(value) {
    this.platform.log.info('New value', this.accessory.context.device.name, value);
    if(value < 0.0001) {
      value = 0.0001;
    }
    this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel).updateValue(value);
  }
}
