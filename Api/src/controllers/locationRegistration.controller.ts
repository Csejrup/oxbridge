import LocationRegistration, { ILocationRegistration } from '../models/locationRegistration';
import EventRegistration, { IEventRegistration } from '../models/eventRegistration';
import Ship from '../models/ship';
import User from '../models/user';
import Event from '../models/event';
import RacePoint, { IRacePoint } from '../models/racePoint';
import Authorize from './authentication.controller';
import { Request, Response } from 'express';

// Create and Save a new locationRegistration
const create = (req: Request, res: Response) => {

    // Checking if authorized 
    Authorize(req, res, "user", function (err: any) {
        if (err)
            return err;

        // Creating the LocationRegistration
        var locationRegistration = new LocationRegistration(req.body);
        createLocationRegistration(locationRegistration, res, function (err: any, locationReg: ILocationRegistration) {
            if (err)
                return err;

            return res.status(201).json(locationReg);
        });
    });
};

// Checks that all foreignkeys are valid. Creates and save a new LocationRegistration. Returns response
const createLocationRegistration = (newLocationRegistration: ILocationRegistration, res: Response, callback: any) => {
    validateForeignKeys(newLocationRegistration, res, function (err: any) {
        if (err)
            return callback(err);

        // Finding next regId
        newLocationRegistration.locationTime.setHours(newLocationRegistration.locationTime.getHours()+2); 
        CheckRacePoint(newLocationRegistration, res, function (updatedRegistration: ILocationRegistration) {
            if (updatedRegistration) {
                newLocationRegistration = updatedRegistration


                LocationRegistration.findOne({}).sort('-regId').exec(function (err, lastRegistration) {
                    if (err)
                        return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving locationRegistrations" }));
                    if (lastRegistration)
                        newLocationRegistration.regId = lastRegistration.regId + 1;
                    else
                        newLocationRegistration.regId = 1;

                    newLocationRegistration.save(function (err) {
                        if (err)
                            return callback(res.send(err));
                        return callback(null, newLocationRegistration);
                    });
                });
            }
        });
    })
};

//Updates racePoint number, if the ship has reached new racePoint and calculates the racescore
function CheckRacePoint(registration: ILocationRegistration, res: Response, callback: any) {
    EventRegistration.findOne({ eventRegId: registration.eventRegId }, { _id: 0, __v: 0 }, null, function (err, eventRegistration) {
        if (err)
            return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving eventRegistrations" }));

        //Checks which racepoint the ship has reached last
        var nextRacePointNumber = 2;
        LocationRegistration.findOne({ eventRegId: registration.eventRegId }, { _id: 0, __v: 0 }, { sort: { 'locationTime': -1 } }, function (err, locationRegistration) {
            if (err)
                return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving locationRegistrations" }));

            if (locationRegistration) {
                nextRacePointNumber = locationRegistration.racePointNumber + 1;
                if (locationRegistration.finishTime != null) {
                    var updatedRegistration = registration;
                    updatedRegistration.racePointNumber = locationRegistration.racePointNumber;
                    updatedRegistration.raceScore = locationRegistration.raceScore;
                    updatedRegistration.finishTime = locationRegistration.finishTime;
                    return callback(updatedRegistration)
                }
            }

            if (eventRegistration) {
                Event.findOne({ eventId: eventRegistration.eventId }, { _id: 0, __v: 0 }, null, function (err, event) {
                    if (err)
                        return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving events" }));

                    if (event && event.isLive) {

                        //Finds the next racepoint and calculates the ships distance to the racepoint
                        //and calculates the score based on the distance
                        RacePoint.findOne({ eventId: eventRegistration.eventId, racePointNumber: nextRacePointNumber }, { _id: 0, __v: 0 }, null, function (err, nextRacePoint) {
                            if (err)
                                return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving racepoints" }));
                            if (nextRacePoint) {
                                FindDistance(registration, nextRacePoint, function (distance: number) {
                                    if (distance < 25) {

                                        if (nextRacePoint.type != "finishLine") {
                                            RacePoint.findOne({ eventId: eventRegistration.eventId, racePointNumber: nextRacePoint.racePointNumber + 1 }, { _id: 0, __v: 0 }, null, function (err, newNextRacePoint) {
                                                if (err)
                                                    return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving racepoints" }));


                                                if (newNextRacePoint) {
                                                    FindDistance(registration, newNextRacePoint, function (nextPointDistance: number) {
                                                        distance = nextPointDistance;

                                                        var updatedRegistration = registration;
                                                        updatedRegistration.racePointNumber = nextRacePointNumber;
                                                        updatedRegistration.raceScore = ((nextRacePointNumber) * 10) + ((nextRacePointNumber) / distance);
                                                        return callback(updatedRegistration)
                                                    });
                                                }

                                            })
                                        } else {
                                            var updatedRegistration = registration;
                                            updatedRegistration.racePointNumber = nextRacePointNumber;
                                            updatedRegistration.finishTime = registration.locationTime
                                            var ticks = ((registration.locationTime.getTime() * 10000) + 621355968000000000);
                                            updatedRegistration.raceScore = (1000000000000000000 - ticks) / 1000000000000
                                            return callback(updatedRegistration);
                                        }
                                    } else {
                                        var updatedRegistration = registration;
                                        updatedRegistration.racePointNumber = nextRacePointNumber - 1;
                                        updatedRegistration.raceScore = ((nextRacePointNumber - 1) * 10) + ((nextRacePointNumber - 1) / distance);
                                        return callback(updatedRegistration)
                                    }
                                });
                            } else {
                                var updatedRegistration = registration;
                                updatedRegistration.racePointNumber = 1;
                                updatedRegistration.raceScore = 0;
                                return callback(updatedRegistration)
                            }
                        });
                    } else {
                        var updatedRegistration = registration;
                        updatedRegistration.racePointNumber = 1;
                        updatedRegistration.raceScore = 0;
                        return callback(updatedRegistration)
                    }
                });
            }
        });
    });
}

//Finds the ships distance to the racepoint
function FindDistance(registration: ILocationRegistration, racePoint: IRacePoint, callback: any) {
    var checkPoint1 = {
        longtitude: racePoint.firstLongtitude,
        latitude: racePoint.firstLatitude,
    };
    var checkPoint2 = {
        longtitude: racePoint.secondLongtitude,
        latitude: racePoint.secondLatitude,
    };

    var AB = CalculateDistance(checkPoint1, checkPoint2);
    var BC = CalculateDistance(checkPoint2, registration);
    var AC = CalculateDistance(checkPoint1, registration);

    var P = (AB + BC + AC) / 2;
    var S = Math.sqrt(P * (P - AC) * (P - AB) * (P - AC));

    var result = 2 * S / AB;
    return callback(result)
}

//Calculates the closets distance from the ship to the checkpoint
function CalculateDistance(first: any, second: any) {
    var R = 6371e3; // metres
    var φ1 = first.latitude * Math.PI / 180; // φ, λ in radians
    var φ2 = second.latitude * Math.PI / 180;
    var Δφ = (second.latitude - first.latitude) * Math.PI / 180;
    var Δλ = (second.longtitude - first.longtitude) * Math.PI / 180;

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    var d = R * c;

    return d;
}

//Retrieve the latest locationRegistrations on all ships in specific event
var pending = 0
const getLive = (req: Request, res: Response) => {
    EventRegistration.find({ eventId: +req.params.eventId }, { _id: 0, __v: 0 }, null, function (err, eventRegistrations) {
        if (err) {
            return res.status(500).send({ message: err.message || "Some error occurred while retriving eventRegistrations" });
        }

        var fewRegistrations: any = [];
        eventRegistrations.forEach(eventRegistration => {
            pending++

            LocationRegistration.find({ eventRegId: eventRegistration.eventRegId }, { _id: 0, __v: 0 }, { sort: { 'locationTime': -1 }, limit: 20 }, function (err, locationRegistration) {
                pending--;
                if (err) {
                    return res.status(500).send({ message: err.message || "Some error occurred while retriving locationRegistrations" });
                }
                if (locationRegistration.length != 0) {
                    var boatLocations = { "locationsRegistrations": locationRegistration, "color": eventRegistration.trackColor, "shipId": eventRegistration.shipId, "teamName": eventRegistration.teamName }
                    fewRegistrations.push(boatLocations);

                }
                if (pending == 0) {
                    if (fewRegistrations.length != 0) {
                        if (fewRegistrations[0].locationsRegistrations[0].raceScore != 0) {
                            fewRegistrations.sort((a: any, b: any) => (a.locationsRegistrations[0].raceScore >= b.locationsRegistrations[0].raceScore) ? -1 : 1)

                            for (let i = 0; i < fewRegistrations.length; i++) {
                                fewRegistrations[i].placement = i + 1;
                            }
                        } else {
                            fewRegistrations.sort((a: any, b: any) => (a.shipId > b.shipId) ? 1 : -1)

                        }
                    }
                    return res.status(200).json(fewRegistrations);
                }
            });
        });
    });
};

//Retrive scoreboard from event
const getScoreboard = (req: Request, res: Response) => {
    var pending = 0;
    EventRegistration.find({ eventId: +req.params.eventId }, { _id: 0, __v: 0 }, null, function (err, eventRegistrations) {
        if (err)
            return res.status(500).send({ message: err.message || "Some error occurred while retriving eventRegistrations" })
        if (eventRegistrations.length !== 0) {
            var scores: any = [];
            eventRegistrations.forEach(eventReg => {
                pending++;
                LocationRegistration.find({ eventRegId: eventReg.eventRegId }, { _id: 0, __v: 0 }, { sort: { 'locationTime': -1 }, limit: 1 }, function (err, locationRegistration) {
                    if (err)
                        return res.status(500).send({ message: err.message || "Some error occurred while retriving locationRegistrations" });
                    if (locationRegistration.length !== 0) {
                        Ship.findOne({ shipId: eventReg.shipId }, { _id: 0, __v: 0 }, null, function (err, ship) {
                            if (err)
                                return res.status(500).send({ message: err.message || "Some error occurred while retriving ships" });
                            if (!ship) return res.status(404).send("Ship not found.");
                            User.findOne({ emailUsername: ship.emailUsername }, { _id: 0, __v: 0 }, null, function (err, user) {
                                pending--;
                                if (err)
                                    return res.status(500).send({ message: err.message || "Some error occurred while retriving users" });
                                if (user) {
                                    var score: any = { "locationsRegistrations": locationRegistration, "color": eventReg.trackColor, "shipId": eventReg.shipId, "shipName": ship.name, "teamName": eventReg.teamName, "owner": user.firstname + " " + user.lastname };
                                    scores.push(score);
                                }
                                if (pending === 0) {
                                    if (scores.length != 0) {
                                        if (scores[0].locationsRegistrations[0].raceScore != 0) {
                                            scores.sort((a: any, b: any) => (a.locationsRegistrations[0].raceScore >= b.locationsRegistrations[0].raceScore) ? -1 : 1)

                                            for (let i = 0; i < scores.length; i++) {
                                                scores[i].placement = i + 1;
                                            }
                                        }
                                        else {
                                            scores.sort((a: any, b: any) => (a.shipId > b.shipId) ? 1 : -1)
                                        }
                                    }
                                    return res.status(200).json(scores);
                                }
                            });
                        })
                    }
                    else
                        pending--;
                })
            })
            if (pending === 0)
                return res.status(200).send(scores);
        }
        else
            return res.status(200).send({});
    })
}


//Retrieve all locationRegistrations from an event
const getReplay = (req: Request, res: Response) => {
    EventRegistration.find({ eventId: +req.params.eventId }, { _id: 0, __v: 0 }, null, function (err, eventRegistrations) {
        if (err) {
            return res.status(500).send({ message: err.message || "Some error occurred while retriving eventRegistrations" })
        }

        if (eventRegistrations.length !== 0) {
            var shipLocations: any = [];
            eventRegistrations.forEach(eventRegistration => {
                pending++
                LocationRegistration.find({ eventRegId: eventRegistration.eventRegId }, { _id: 0, __v: 0 }, { sort: { 'locationTime': 1 } }, function (err, locationRegistrations) {
                    pending--
                    if (err)
                        return res.status(500).send({ message: err.message || "Some error occurred while retriving registrations" })
                    if (locationRegistrations) {
                        var shipLocation = { "locationsRegistrations": locationRegistrations, "color": eventRegistration.trackColor, "shipId": eventRegistration.shipId, "teamName": eventRegistration.teamName }
                        shipLocations.push(shipLocation)
                    }
                    if (pending === 0) {
                        return res.status(200).send(shipLocations)
                    }
                });
            });
        } else {
            return res.status(200).send({})
        }
    });
};

//Deleting all locationRegistration with an given eventRegId
const deleteFromEventRegId = (req: Request, res: Response) => {

    // Checking if authorized 
    Authorize(req, res, "user", function (err: any) {
        if (err)
            return err;

        // Finding and deleting the locationRegistrations with the given eventRegId
        const filter = { eventRegId: +req.params.eventId };
        LocationRegistration.find(filter, function (err, locationRegistrations) {
            if (err)
                return res.status(500).send({ message: "Error deleting locationRegistrations with eventRegId " + req.params.regId });
            if (!locationRegistrations)
                return res.status(404).send({ message: "LocationRegistrations not found with eventRegId " + req.params.regId });

            LocationRegistration.deleteMany(filter, function (err: any) {
                if (err)
                    return res.status(500).send({ message: "Error deleting locationRegistrations with eventRegId " + req.params.regId });
                if (!locationRegistrations)
                    return res.status(404).send({ message: "LocationRegistrations not found with eventRegId " + req.params.regId });
    
                res.status(202).json(locationRegistrations);
            });
        });
    });
};

function validateForeignKeys(registration: ILocationRegistration, res: Response, callback: any) {

    // Checking if eventReg exists
    EventRegistration.findOne({ eventRegId: registration.eventRegId }, function (err: any, eventReg: IEventRegistration) {
        if (err)
            return callback(res.status(500).send({ message: err.message || "Some error occurred while retriving event eventRegistration" }));
        if (!eventReg)
            return callback(res.status(404).send({ message: "EventRegistration with id " + registration.eventRegId + " was not found" }));

        return callback();
    });
}

export default {
    create,
    getLive,
    getScoreboard,
    getReplay,
    deleteFromEventRegId
}