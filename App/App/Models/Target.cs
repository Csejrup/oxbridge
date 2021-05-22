﻿using System;

namespace Oxbridge.App.Models
{
    public static class Target
    {
        private const String azure = "http://192.168.1.190:3000/api/";

        private const String StandardAdress = azure;


        public const String Authenticate = StandardAdress + "users/login";
        public const String Events = StandardAdress + "event/";
        public const String EventsFromUsername = StandardAdress + "event/myevents/findfromusername";
        public const String EventRegistrations = StandardAdress + "eventRegistrations/findEventRegFromUsername/";
        public const String Locations = StandardAdress + "locationRegistrations/";
        public const String StartAndFinishPoints = StandardAdress + "racepoints/findStartAndFinish/";
        public const String LiveLocations = StandardAdress + "locationRegistrations/getlive/";
        public const String ReplayLocations = StandardAdress + "locationRegistrations/getReplay/";
        public const String Ships = StandardAdress + "ships/";
        public const String ShipFromEventId = StandardAdress + "ships/fromeventid/";
    }
}
