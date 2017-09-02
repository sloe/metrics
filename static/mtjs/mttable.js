
function MtIntervalTable () {

    this.create = function(mtId, intervalCollection) {
        this.mtId = mtId;
        this.intervalCollection = intervalCollection;

        this.containerName = 'intervaltable' + mtId;
        this.containerElem = document.getElementById(this.containerName);

        this.columnAttrs = [
            'start_time',
            'end_time',
            'num_events',
            'rate'
        ];

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
                        interval.set(name, value, {source: 'table'});
                    }
                },
            };
        };

        this.hot = new Handsontable(this.containerElem, {
            colHeaders: ['Start', 'End', 'Number', 'Rate'],
            columns: [
                columnFn('start_time'),
                columnFn('end_time'),
                columnFn('num_events'),
                columnFn('rate')
            ],
            contextMenu: true,
            data: this.intervalCollection,
            dataSchema: makeInterval,
            enterMoves: {col:0, row: 0},
            manualColumnResize: true,
            minSpareRows: 0,
            minSpareCols: 0,
            outsideClickDeselects : false,
            rowHeaders: true
        });


        this.intervalCollection.on('update', this.onIntervalCollectionUpdate, this);

        this.hot.addHook('afterSelectionEnd', this.tableAfterSelectionEnd.bind(this));

        Backbone.Mediator.subscribe('mt:intervalCollectionValueChange', this.onMtCollectionValueChange, this);
        Backbone.Mediator.subscribe('mt:controlFinish', this.onMtControlFinish, this);
    };


    this.propertyNameToColumn = function(propertyName) {
        return this.columnAttrs.indexOf(propertyName);
    };


    this.onIntervalCollectionUpdate = function(collection, options) {
        console.log('MtParamTable.onIntervalCollectionUpdate: ' + (collection.mtName && collection.mtName()) + ', ' + JSON.stringify(options));
        this.hot.render();
    };

    this.tableAfterSelectionEnd = function(r, c, r2, c2) {
        var selection =  {
                r: r,
                c: c,
                r2: r2,
                c2: c2
        };

        if (!_.isEqual(selection, this.lastSelection)) {

            var values = this.intervalCollection.at(r).attributes;

            Backbone.Mediator.publish('mt:selectionChange', {
                activeRow: r,
                mtId: this.mtId,
                selection: selection,
                source: 'table',
                values: values
            });

            this.lastSelection = selection;

            var now = new Date();
            var message = ['MtIntervalTable.tableAfterSelectionEnd: ', now.getSeconds(), ':', now.getMilliseconds(),
            ' (', r, ', ', c, ') to (', r2, ', ', c2, ')'];
            console.log(message.join(''));
        }
    };


    this.onMtCollectionValueChange = function(model, options) {
        console.log('MtIntervalTable.onMtCollectionValueChange: ' + JSON.stringify(model) + JSON.stringify(options));

        if (model.collection.mtId === this.mtId && model.changed && _.keys(model.changed).length >= 1 && options.source !== 'table') {
            if (_.isUndefined(options.row)) {
                console.log("Error: MtIntervalTable.onMtCollectionValueChange undefined row");
            }
            var property = _.keys(model.changed)[0];
            var column = this.propertyNameToColumn(property);

            // This could be a slider drag so we mustn't steal the focus
            var selection = this.hot.getSelected();
            if (!selection || selection[0] !== options.row || selection[1] !== column) {
                this.hot.selection.setRangeStartOnly(new CellCoords(options.row, column));
                this.hot.selection.setRangeEnd(new CellCoords(options.row, column), false);
            }

        }

        if (model.collection.mtId === this.mtId) {
            this.hot.render();
        }
    };

    this.onMtControlFinish = function(event) {
        console.log('MtIntervalTable.onMtControlFinish: ' + JSON.stringify(event));

        var options = event.options;
        if (options.mtId === this.mtId && event.changes && _.keys(event.changes).length >= 1 && options.source !== 'table') {
            var change = event.changes[0];
            var column = this.propertyNameToColumn(change.property);
            this.hot.selectCell(options.row, column, options.row, column, false);

            this.hot.render();
        }
    };
};




function MtParamTable () {

    this.create = function(mtId, paramCollection) {
        this.mtId = mtId;
        this.paramCollection = paramCollection;

        this.containerName = 'paramtable' + mtId;
        this.containerElem = document.getElementById(this.containerName);

        function makeParam() {
            return new MtParamModel();
        };

        function columnFn(name) {
            return {
                data: function (param, value) {
                    if (_.isUndefined(param)) {
                        return name;
                    } else if (_.isUndefined(value)) {
                        return param.get(name);
                    } else {
                        param.set(name, value, {source: 'table'});
                    }
                },
            };
        };

        this.hot = new Handsontable(this.containerElem, {
            colHeaders: ['Parameter', 'Value'],
            columns: [
                columnFn('displayName'),
                columnFn('value')
            ],
            contextMenu: true,
            data: this.paramCollection,
            dataSchema: makeParam,
            enterMoves: {col:0, row: 1},
            manualColumnResize: true,
            minSpareRows: 0,
            minSpareCols: 0,
            outsideClickDeselects : true
        });


        this.paramCollection.on('update', this.onParamCollectionUpdate, this);
        Backbone.Mediator.subscribe('mt:paramCollectionValueChange', this.onMtParamCollectionValueChange, this);
    };


    this.onParamCollectionUpdate = function(collection, options) {
        console.log('MtParamTable.onParamCollectionUpdate: ' + (collection.mtName && collection.mtName()) + ', ' + JSON.stringify(options));
        this.hot.render();
    };


    this.onMtCollectionValueChange = function(model, options) {
        console.log('MtParamTable.onMtParamCollectionValueChange: ' + JSON.stringify(model) + ', ' + JSON.stringify(options));
        this.hot.render();
    };
};