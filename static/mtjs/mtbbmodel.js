


// FIXME

/**
 * CellCoords holds cell coordinates (row, column) and few method to validate them and
 * retrieve as an array or an object
 *
 * @class CellCoords
 */
class CellCoords {
  /**
   * @param {Number} row Row index
   * @param {Number} col Column index
   */
  constructor(row, col) {
    if (typeof row !== 'undefined' && typeof col !== 'undefined') {
      this.row = row;
      this.col = col;

    } else {
      this.row = null;
      this.col = null;
    }
  }

  /**
   * Checks if given set of coordinates is valid in context of a given Walkontable instance
   *
   * @param {Walkontable} wotInstance
   * @returns {Boolean}
   */
  isValid(wotInstance) {
    // is it a valid cell index (0 or higher)
    if (this.row < 0 || this.col < 0) {
      return false;
    }
    // is selection within total rows and columns
    if (this.row >= wotInstance.getSetting('totalRows') || this.col >= wotInstance.getSetting('totalColumns')) {
      return false;
    }

    return true;
  }

  /**
   * Checks if this cell coords are the same as cell coords given as a parameter
   *
   * @param {CellCoords} cellCoords
   * @returns {Boolean}
   */
  isEqual(cellCoords) {
    if (cellCoords === this) {
      return true;
    }

    return this.row === cellCoords.row && this.col === cellCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in south-east from this cell coords
   *
   * @param {Object} testedCoords
   * @returns {Boolean}
   */
  isSouthEastOf(testedCoords) {
    return this.row >= testedCoords.row && this.col >= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in north-east from this cell coords
   *
   * @param {Object} testedCoords
   * @returns {Boolean}
   */
  isNorthWestOf(testedCoords) {
    return this.row <= testedCoords.row && this.col <= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in south-west from this cell coords
   *
   * @param {Object} testedCoords
   * @returns {Boolean}
   */
  isSouthWestOf(testedCoords) {
    return this.row >= testedCoords.row && this.col <= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in north-east from this cell coords
   *
   * @param {Object} testedCoords
   * @returns {Boolean}
   */
  isNorthEastOf(testedCoords) {
    return this.row <= testedCoords.row && this.col >= testedCoords.col;
  }
}

// END FIXME


"use strict";

var MtIntervalModel = Backbone.Model.extend({});

function _emulateSplice(index, howMany) {
    var args = _.toArray(arguments).slice(2).concat({at: index});
    var removed = this.models.slice(index, index + howMany);
    this.remove(removed).add.apply(this, args);
    return removed;
};

var MtIntervalCollection = Backbone.Collection.extend({
    model: MtIntervalModel,
    splice: _emulateSplice
});

function MtInterval () {

    this.create = function(id) {
        this.id = id;
        this.containerName = 'intervaltable' + id;
        this.containerElem = document.getElementById(this.containerName);
        //addCar = document.getElementById('add_car'),
        //eventHolder = document.getElementById('example1_events'),

        this.intervals = new MtIntervalCollection();

        this.intervals.add([
            {start_time: 1, end_time: 21, num_events: 10},
            {start_time: 23, end_time: 23, num_events: 14}
        ]);

        function makeInterval() {
            return new MtIntervalModel();
        };

        function columnFn(name) {
            return {
                data: function (interval, value) {
                    if (_.isUndefined(interval)) {
                        return name;
                    } else if (_.isUndefined(value)) {
                        return interval.get(name);
                    } else {
                        interval.set(name, value);
                    }
                },
            };
        };

        this.columnAttrs = [
            'start_time',
            'end_time',
            'num_events'
        ];

        this.hot = new Handsontable(this.containerElem, {
            colHeaders: ['Start', 'End', 'Number'],
            columns: [
                columnFn('start_time'),
                columnFn('end_time'),
                columnFn('num_events')
            ],
            contextMenu: true,
            data: this.intervals,
            dataSchema: makeInterval,
            enterMoves: {col:0, row: 0},
            manualColumnResize: true,
            minSpareRows: 1,
            minSpareCols: 1,
            outsideClickDeselects : true,
            rowHeaders: true
        });


        this.intervals.on('all', this.intervalsOnAll, this);
        this.hot.addHook('afterChange', this.tableAfterChange.bind(this));
        this.hot.addHook('afterSelectionEnd', this.tableAfterSelectionEnd.bind(this));

        Backbone.Mediator.subscribe('mt:valueChange', this.onValueChange, this);
    };


    this.propertyNameToColumn = function(propertyName) {
        return this.columnAttrs.indexOf(propertyName);
    };


    this.intervalsOnAll = function(event, model) {
        var now = new Date();
        var message = ['intervalsOnAll: ', now.getSeconds(), ':', now.getMilliseconds(), ' [' + event + '] ', JSON.stringify(model)].join('');
        console.log(message);
    };

    this.tableAfterChange = function(changes, source) {
        if (source === 'edit' || source === 'CopyPaste.paste') {
            _.each(changes, function(change) {
                var property = change[1]();
                var value = change[3];
                Backbone.Mediator.publish('mt:valueChange', {
                    changes: [{property: property, value: value}],
                    id: this.id,
                    source: 'table'
                });
            }, this);
        } else {
            var now = new Date();
            var message = ['tableAfterChange: ', now.getSeconds(), ':', now.getMilliseconds(), ' ', source, ''];
            console.log(message.join(''));
        }
    };


    this.tableAfterSelectionEnd = function(r, c, r2, c2) {
        var selection =  {
                r: r,
                c: c,
                r2: r2,
                c2: c2
        };

        if (!_.isEqual(selection, this.lastSelection)) {

            var values = this.intervals.at(r).attributes;

            Backbone.Mediator.publish('mt:selectionChange', {
                activeRow: r,
                id: this.id,
                selection: selection,
                source: 'table',
                values: values
            });

            this.lastSelection = selection;

            var now = new Date();
            var message = ['tableAfterSelectionEnd: ', now.getSeconds(), ':', now.getMilliseconds(),
            ' (', r, ', ', c, ') to (', r2, ', ', c2, ')'];
            console.log(message.join(''));
        }
    };


    this.onValueChange = function(event) {
        if (event.id === this.id && event.source !== 'table') {
            console.log('MtInterval.onValueChange: ' + JSON.stringify(event));
            _.each(event.changes, function(change) {
                var selectedModel = this.intervals.at(change.row);
                var setParams = {};
                setParams[change.property] = change.value;
                selectedModel.set(setParams);
            }, this);

            if (event.source === 'slider' && event.changes && event.changes.length === 1) {
                var change = event.changes[0];
                var column = this.propertyNameToColumn(change.property);
                var selection = this.hot.getSelected();
                if (!selection || selection[0] !== change.row || selection[1] !== column) {
                    this.hot.selection.setRangeStart(new CellCoords(change.row, column));
                    this.hot.selection.setRangeEnd(new CellCoords(change.row, column));
                }
            }
            this.hot.render();
        }
    };
};


var ItemModel = Backbone.Model.extend({
    parse: function(data) {
        return data.item;
    },
    url: '/apiv1/item/1.json',
    defaults: {
        f_name: 'defaultname',
        f_sourceid: 'defaultsourceid'
    }

});

