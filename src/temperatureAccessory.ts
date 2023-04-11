import { Service, PlatformAccessory } from 'homebridge';
import { HomebridgeSems } from './platform';
import { PowerStationAccessory } from './powerStationAccessory';
import { dig } from 'dig-ts';


export class TemperatureAccessory extends PowerStationAccessory {
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

    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);
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
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).updateValue(value);
  }
}
