const _ = require('lodash');
const moment = require('moment');
const neo4j = require('../neo4j');
const Promise = require('bluebird');
const CUDCommand = require('../cud/CUDCommand');

const cud = (req, res) => {
    const records = req.body;

    if (_.isNil(records) || !_.isArray(records) || _.isEmpty(records)) {
        return Promise.resolve(res.status(400).json({
            date: moment.utc().format(),
            error: `Required: a non-empty JSON array of CUD messages`,
        }));
    }

    let commands;

    try { 
        commands = records.map(rec => new CUDCommand(rec));
    } catch(e) {
        // This is going to be a CUD message formatting error
        return Promise.resolve(res.status(400).json({
            date: moment.utc().format(),
            error: `${e}`,
        }));
    }

    const session = neo4j.getDriver().session();

    // Use of mapSeries is important here to run promises *in order* since some CUD messages
    // may depend on previous ones succeeding.
    return session.writeTransaction(tx =>
        Promise.mapSeries(commands, cudCommand => cudCommand.run(tx))
    )
        .then(results => {
            return res.status(200).json(results);
        })
        .catch(err => {
            return res.status(500).json({
                date: moment.utc().format(),
                error: `${err}`,
                stack: err.stack,
            });
        })
        .finally(session.close);
};

module.exports = cud;