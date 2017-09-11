
"use strict";

var MtIntervalModel = Backbone.Model.extend({
    recalculate: function(options) {
        var attr = this.attributes;
        var paramProvider = this.collection.mtParamProvider;
        var speedFactor = paramProvider.getParam('speed_factor');

        if (options.originator === 'speed_factor' || options.originator === 'fetch' || (options.originator !== 'rate' && _.isUndefined(this.changed.rate))) {
            // num_events or speed_factor was changed by the user so recaculate the rate based on it
            var newRate = (attr.num_events * speedFactor * 60) / (attr.end_time - attr.start_time);
            this.set({rate: newRate}, options);
        } else if (options.originator === 'rate' && _.isUndefined(this.changed.num_events)) {
            // rate was changed by the user so recaculate the number of events based on it
            var newNumEvents = Math.round((attr.end_time - attr.start_time) * attr.rate / (60 * speedFactor));
            this.set({num_events: newNumEvents}, options);
        }


        if (options.originator === 'fetch' || (options.originator !== 'interval' && _.isUndefined(this.changed.interval))) {
            var newInterval = parseFloat(attr.end_time) - parseFloat(attr.start_time);
            this.set({interval: newInterval}, options);
        } else if (options.originator === 'interval' && _.isUndefined(this.changed.start_time) && _.isUndefined(this.changed.end_time)) {
            var newEndTime = parseFloat(attr.start_time,) + parseFloat(attr.interval);
            this.set({end_time: newEndTime}, options);
        }

        if (attr.link_end_to_start !== true && attr.link_end_to_start !== false) {
            attr.link_end_to_start = false;
        }

        var rowIndex = this.collection.indexOf(this);

        if (attr.link_end_to_start && rowIndex + 1 < this.collection.length &&
            (options.originator === 'link_end_to_start' || !_.isUndefined(this.changed.end_time))) {
            var nextModel = this.collection.at(rowIndex + 1);
            var nextOptions = jQuery.extend({}, options);
            nextOptions.row = rowIndex + 1;
            nextModel.set({start_time: attr.end_time}, nextOptions);
        }

        if (!_.isUndefined(this.changed.start_time) && rowIndex > 0) {
            var previousModel = this.collection.at(rowIndex - 1);
            if (previousModel.attributes.link_end_to_start) {
                var previousOptions = jQuery.extend({}, options);
                previousOptions.row = rowIndex - 1;
                previousModel.set({end_time: attr.start_time}, previousOptions);
            }
        }

        if (options.originator !== 'fetch' && (_.isUndefined(options.ongoing) || !options.ongoing)) {
            if (!_.isUndefined(rowIndex)) {
                if (rowIndex < 0) {
                    mtlog.log('MtIntervalModel.recalculate: Bad row index ' + rowIndex);
                } else {
                    this.save(null, {url: this.collection.url + '/' + rowIndex});
                }
            }
        }
    }
});


var MtIntervalCollection = Backbone.Collection.extend({
    model: MtIntervalModel,
    parse: function(response) {
        return response.interval;
    },
    splice: MtUtil.emulateSplice,

    initialize: function(models, options) {
        this.datasetId = options.datasetId;
        this.mtId = options.mtId;
        this.mtParamProvider = options.mtParamProvider;
        this.url = '/apiv1/interval/' + this.datasetId;
        this.on('all', this.onAll, this);
        this.on('add', this.onAdd, this);
        this.on('change', this.onChange, this);
        Backbone.Mediator.subscribe('mt:controlChangedValue', this.onMtControlChangedValueOrFinish, this);
        Backbone.Mediator.subscribe('mt:controlFinish', this.onMtControlChangedValueOrFinish, this);
        Backbone.Mediator.subscribe('mt:intervalRowsDeleted', this.onMtIntervalRowsDeleted, this);
        Backbone.Mediator.subscribe('mt:paramCollectionValueChange', this.onMtParamCollectionValueChange, this);
    },


    mtName: function() {
        return 'MtIntervalCollection' + this.mtId;
    },


    loadInitialErrorCallback: function(collection, response, options) {
        mtlog.warn("MtIntervalCollection.loadInitialErrorCallback: collection=%s, response=%s, options=%s", collection, JSON.stringify(response), JSON.stringify(options));
    },


    loadInitialSuccessCallback: function(collection, response, options) {
        mtlog.debug("MtIntervalCollection.loadInitialSuccessCallback: collection=%s, response=%s, options=%s", collection, JSON.stringify(response), JSON.stringify(options));

        if (collection.length == 0) {
            collection.add([{}]);
        }
    },


    loadInitial: function() {
        return this.fetch({
            error: this.loadInitialErrorCallback,
            originator: 'fetch',
            success: this.loadInitialSuccessCallback
        });
    },


    recalculateAll: function(options) {
        _.each(this.models, function(model) {
            model.recalculate(options);
        });
    },


    saveAll: function() {
        _.each(this.models, function(model, row_index) {
            model.save(null, {url: this.url + '/' + row_index});
        }, this);
    },


    onAll: function(event, model) {
        var now = new Date();
        var message = ['MtIntervalCollection.onAll: ', now.getSeconds(), ':', now.getMilliseconds(), ' [' + event + '] ', JSON.stringify(model)].join('');
        mtlog.log(message);
    },


    onAdd: function(model, collection, options) {
        var message = ['MtIntervalCollection.onAdd ', JSON.stringify(model), JSON.stringify(collection), JSON.stringify(options)].join(', ');
        mtlog.log(message);

        if (_.isEmpty(model.attributes)) {
            // Create default values from neighbouring rows
            var rowIndex = options.at;

            if (rowIndex === 0) {
                if (collection.length > 1) {
                    var sourceModel = collection.at(1);
                    var sourceAttr = sourceModel.attributes;

                    model.set({
                        start_time: parseFloat(sourceAttr.start_time) - parseFloat(sourceAttr.interval),
                        end_time: sourceAttr.start_time,
                        interval: sourceAttr.interval,
                        num_events: sourceAttr.num_events,
                        link_end_to_start: sourceAttr.link_end_to_start
                    }, {originator: 'add_row'});
                }
            } else if (!_.isUndefined(rowIndex)) {
                var sourceModel = collection.at(rowIndex - 1);
                var sourceAttr = sourceModel.attributes;

                model.set({
                    start_time: sourceAttr.end_time,
                    end_time: parseFloat(sourceAttr.end_time) + parseFloat(sourceAttr.interval),
                    interval: sourceAttr.interval,
                    num_events: sourceAttr.num_events,
                    link_end_to_start: sourceAttr.link_end_to_start
                }, {originator: 'add_row'});
            }
        }

        model.recalculate(options);
    },


    onChange: function(model, options) {
        var message = ['MtIntervalCollection.onChange: ', JSON.stringify(model), JSON.stringify(options)].join(', ');
        mtlog.log(message);

        if (!options.originator && model.changed) {
            options.originator = _.keys(model.changed)[0]
        }

        model.recalculate(options);

        Backbone.Mediator.publish('mt:intervalCollectionValueChange', model, options);
    },


    onMtControlChangedValueOrFinish: function(event) {
        mtlog.log('MtIntervalCollection.onMtControlChangedValueOrFinish: ' + JSON.stringify(event));
        if (event.options.mtId === this.mtId) {
            _.each(event.changes, function(change) {
                var selectedModel = this.at(change.row);
                var setParamsSilent = {};
                var setParams = {};
                setParamsSilent[change.property] = change.value + 1;
                setParams[change.property] = change.value;
                // Make sure that change event is triggered if the value is unchanged (FIXME)
                selectedModel.set(setParamsSilent, {silent: true});
                selectedModel.set(setParams, event.options);
                selectedModel.recalculate(event.options);
            }, this);
        }
    },


    onMtIntervalRowsDeleted: function(event) {
        mtlog.log('MtIntervalCollection.onMtIntervalRowsDeleted: ' + JSON.stringify(event));
        if (event.mtId === this.mtId) {
            for (var row_index = event.index; row_index < event.index + event.amount; row_index++) {
                var model_to_destroy = this.at(row_index);
                model_to_destroy.destroy({source: event.source, url: this.url + '/' + row_index});
            }
        }
    },


    onMtParamCollectionValueChange: function(model, options) {
        mtlog.log('MtIntervalCollection.onMtParamCollectionValueChange: ' + JSON.stringify(event));

        this.recalculateAll(options);
    }
});


var MtParamModel = Backbone.Model.extend({
    recalculate: function(options) {
        if (options.originator !== 'fetch' && (_.isUndefined(options.ongoing) || !options.ongoing)) {
            var row_index = this.collection.indexOf(this);
            if (!_.isUndefined(row_index)) {
                if (row_index < 0) {
                    mtlog.log('MtIntervalModel.recalculate: Bad row index ' + row_index);
                } else {
                    this.save(null, {url: this.collection.url + '/' + row_index});
                }
            }
        }
    }
});


var MtParamCollection = Backbone.Collection.extend({
    model: MtParamModel,
    parse: function(response) {
        return response.param;
    },
    splice: MtUtil.emulateSplice,


    initialize: function(models, options) {
        this.datasetId = options.datasetId;
        this.mtId = options.mtId;
        this.url = '/apiv1/param/' + this.datasetId;

        this.on('change', this.onChange, this);

        Backbone.Mediator.subscribe('mt:paramChangedValue', this.onMtParamChangedValue, this);
    },


    makeDefault: function() {
        this.add([
            {param: 'speed_factor', displayName: 'Speed factor', value: 1.0},
            {param: 'video_duration', displayName: 'Video duration', value: null}
        ]);
    },


    mtName: function() {
        return 'MtParamCollection' + this.mtId;
    },


    loadInitialErrorCallback: function(collection, response, options) {
        mtlog.warn("MtParamCollection.loadInitialErrorCallback: collection=%s, response=%s, options=%s", collection, JSON.stringify(response), JSON.stringify(options));
    },


    loadInitialSuccessCallback: function(collection, response, options) {
        mtlog.debug("MtParamCollection.loadInitialSuccessCallback: collection=%s, response=%s, options=%s", collection, JSON.stringify(response), JSON.stringify(options));

        if (collection.length == 0) {
            collection.makeDefault();
        }
    },


    loadInitial: function() {
        return this.fetch({
            error: this.loadInitialErrorCallback,
            originator: 'fetch',
            success: this.loadInitialSuccessCallback
        });
    },


    onChange: function(model, options) {
        var message = ['MtParamCollection.onChange: ', JSON.stringify(model), ', ', JSON.stringify(options)].join('');
        mtlog.log(message);

        if (!options.originator) {
            options.originator = model.attributes.param;
        }

        model.recalculate(options);

        Backbone.Mediator.publish('mt:paramCollectionValueChange', model, options);
    },


    onMtParamChangedValue: function(event) {
        mtlog.log('MtParamCollection.onMtParamChangedValue: %s', JSON.stringify(event));

        if (event.options.mtId === this.mtId) {
            _.each(event.changes, function(change) {
                var paramModel = this.findWhere({param: change.property});
                if (_.isUndefined(paramModel)) {
                    mtlog.warn("No model for parameter '%s'", change.property);
                } else {
                    paramModel.set({value: change.value}, event.options);
                }
            }, this);
        }
    },


    getParam: function(param, defaultValue) {
        var paramModel = this.findWhere({param: param});
        var retVal;

        if (_.isUndefined(paramModel)) {
            retVal = defaultValue;
            var message = ['MtParamCollection.getParam: Returning default value for ', param, ': ', retVal].join('');
        } else {
            retVal = paramModel.attributes.value
            var message = ['MtParamCollection.getParam: ', param, ' returning ', retVal].join('');
        }
        mtlog.debug(message);
        return retVal;
    }
});
