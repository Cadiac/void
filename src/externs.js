/**
 * @fileoverview Global variables for audio_sointu.js and dat.gui
 * @externs
 */

/** @const */
var dat = {};

/**
 * @constructor
 */
dat.GUI = function () {};

/**
 * Adds a folder to the GUI.
 * @param {string} name The name of the folder.
 * @return {dat.GUI} The new folder.
 */
dat.GUI.prototype.addFolder = function (name) {};

/**
 * Adds a control for a property of an object.
 * @param {Object} object The object to be controlled.
 * @param {string} property The property to control.
 * @return {{listen: function(): void}} The controller for the added property.
 */
dat.GUI.prototype.add = function (object, property) {
  return {
    listen: function () {},
  };
};

/**
 * Adds a color controller to the GUI.
 * @param {Object} object The object containing the color property.
 * @param {string} property The color property to control.
 * @return {dat.GUI} The controller for the color property.
 */
dat.GUI.prototype.addColor = function (object, property) {};

// For sointu audio WebAssembly
const f = [];
const obj = {};
obj.exports = {};
obj.exports.m = {};
obj.exports.m.buffer;
obj.exports.s;
obj.exports.l;
