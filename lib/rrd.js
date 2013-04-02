/*
 The aim of this module is to provide an API which matches as closely as possible the intent of the rrdtool CLI
 interface.
 */
var exec = require('child_process').exec;

var RRDTool = function (options) {
  this.options = options || {};
  if (this.options.hasOwnProperty('path')) {
    this.path = this.options.path;
  }
};

RRDTool.prototype.getPath = function () {
  return this.path || 'rrdtool';
};

RRDTool.prototype._locateText = function (regex, text) {
  return text.match(regex);
};

/**
 * Standard javascript date to unix time conversion function. As with moment.js this value is floored to the nearest
 * second, and does not include a milliseconds component.
 *
 * @param date
 * @return {Number}
 */
RRDTool.prototype.unixTime = function (date) {
  return Math.floor(date / 1000);
};

/**
 * Method to exec the rrdtool command with the supplied args.
 *
 * @param argsArray
 * @param onErr
 * @param onSuccess
 */
RRDTool.prototype.rrdExec = function (argsArray, onErr, onSuccess) {
  var path = this.getPath()
    , args = [path].concat(argsArray).join(' ')

//  console.log('args', args);

  var child = exec(args                 // TODO keep a track of child processes.
    , function (err, stdout, stderr) {  // rrdtool currently doesn't seem to use stderr at all..
      if (err !== null) {
        onErr(err);
      } else {
        onSuccess(stdout);
      }
    }
  );

};

/**
 * Just call the rrdtool command to ensure it is installed.
 *
 * @param callback
 */
RRDTool.prototype.version = function (callback) {
  this.rrdExec(['--help'] // supplying no args results in usage being printed to stdout
    , callback
    , function (data) {
      var result = this._locateText(/^RRDtool ([0-9\.]+)/, data); //either null or contains items.
      if (!result) {
        callback('Unable to locate version string.');
      } else {
        callback(null, result[0]);
      }
    }.bind(this)
  );
};

/**
 * Uses the info action within rrdtool to provide a summary of the supplied rrd file content.
 *
 * @param filePath
 * @param callback
 */
RRDTool.prototype.info = function (filePath, callback) {

  var self = this;

  this.rrdExec(['info', filePath] // TODO this needs to be a bit more adaptive.
    , callback
    , function (data) {

      var info = {};

      var lines = data.split("\n");

      lines.forEach(function (line) {
        var result = self._locateText(/^ds\[([a-zA-Z]+)\]\.([a-zA-Z]+) = (.*)$/, line);
        if (result && result.length == 4) {
          if (!info[result[1]]) {
            info[result[1]] = {};
          }
          var value = Number(result[3]);
          if (Number.isNaN(value)) {
            info[result[1]][result[2]] = result[3].replace(/['"]/g, '');
          } else {
            info[result[1]][result[2]] = Number(result[3]);
          }
        }
      });
//      console.log('info', info)
      callback(null, info);

    }.bind(this)
  );
};

/**
 * Fetch will analyze the RRD and try to retrieve the data in the resolution requested.
 *
 * @param filePath
 * @param cf - Consolidation function, possible values are  AVERAGE, MIN, MAX or LAST
 * @param startTimestamp - The start date as a unix timestamp
 * @param endTimestamp - The end date as a unix timestamp
 * @param resolution - The interval you want the values to have (seconds per value).
 * @param callback
 */
RRDTool.prototype.fetch = function (filePath, cf, startTimestamp, endTimestamp, resolution, callback) {

  var args = ['fetch', filePath, cf, '--start', startTimestamp, '--end', endTimestamp];

  if (resolution) {
    args.push('--resolution', resolution);
  }

  this.rrdExec(args // TODO this needs to be a bit more adaptive.
    , callback
    , function (data) {

      var lines = data.split('\n')
        , headerLine = lines.shift()
        , emptyLineFilter = function (val) {
          return (val != '')
        }
        , convertToNumber = function (val) {
          return (Number(val));
        }
        , splitLineOfNumbers = function (line) {
          return line.split(/[:\ ]+/).map(convertToNumber);
        }
        , results = {
          headers: headerLine.split(/\ +/).filter(emptyLineFilter),
          data: lines.filter(emptyLineFilter).map(splitLineOfNumbers)
        };

      // prepend timestamp column
      results.headers.unshift('timestamp');

//      console.log('results', results);
      callback(null, results);

    }.bind(this)
  );
};

/**
 * Create a new RRD file.
 *
 * @param filePath
 * @param ds - An array of data sources, this will typically consist of one or more metrics.
 * @param rra = An array of round robin archives.
 * @param callback
 */
RRDTool.prototype.create = function (filePath, ds, rra, callback) {

  var args = ['create', filePath].concat(ds).concat(rra);

  this.rrdExec(args // TODO this needs to be a bit more adaptive.
    , callback
    , function (data) {

      callback(null);

    }.bind(this)
  );
};

/**
 * Update the RRD file adding one or more values.
 *
 * @param filePath
 * @param values
 * @param callback
 */
RRDTool.prototype.update = function (filePath, values, callback) {

  var args = ['update', filePath].concat(values);

  this.rrdExec(args // TODO this needs to be a bit more adaptive.
    , callback
    , function (data) {

    }.bind(this)
  );
};

module.exports = RRDTool;