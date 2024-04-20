/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
"use strict";

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// This is the live instance of the Quick Settings menu
const QuickSettingsMenu = Main.panel.statusArea.quickSettings;

class KbdBrightnessProxy {
    constructor(callback) {
        const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(`
            <node>
            <interface name="org.freedesktop.UPower.KbdBacklight">
                <method name="SetBrightness">
                    <arg name="value" type="i" direction="in"/>
                </method>
                <method name="GetBrightness">
                    <arg name="value" type="i" direction="out"/>
                </method>
                <method name="GetMaxBrightness">
                    <arg name="value" type="i" direction="out"/>
                </method>
                <signal name="BrightnessChanged">
                    <arg type="i"/>
                </signal>
            </interface>
            </node>`);
        this._proxy = new BrightnessProxy(
            Gio.DBus.system,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower/KbdBacklight',
            callback);
    }

    get Brightness() {
        return this._proxy.GetBrightnessSync() / this.getMaxBrightness();
    }

    set Brightness(value) {
        const brightness = Math.round(value * this.getMaxBrightness());
        log(`Setting brightness to ${brightness}`);
        this._proxy.SetBrightnessSync(brightness);
    }

    getMaxBrightness() {
        return this._proxy.GetMaxBrightnessSync();
    }
}

const FeatureSlider = GObject.registerClass(
    class FeatureSlider extends QuickSettings.QuickSlider {
        _init() {
            super._init({
                iconName: 'keyboard-brightness-symbolic',
            });

            this._sliderChangedId = this.slider.connect('notify::value',
                this._onSliderChanged.bind(this));

            this.slider.accessible_name = 'Keyboard Brightness';

            // create instance of KbpBrightnessProxy
            this._proxy = new KbdBrightnessProxy((proxy, error) => {
                if (error) throw error;
                // proxy.connectSignal('BrightnessChanged', this._sync.bind(this));
                // this._sync();
            });
        }

        _onSliderChanged() {
            this._proxy.Brightness = this.slider.value;
        }
    });

export default class KeyboardBacklightExtension extends Extension {
    enable() {

        this._indicator = new QuickSettings.SystemIndicator();
        this._indicator.quickSettingsItems.push(new FeatureSlider());
        
        QuickSettingsMenu.addExternalIndicator(this._indicator, 2);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
        this._indicator = null;
    }
}