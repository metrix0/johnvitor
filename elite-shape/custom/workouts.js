var lisst = workout1day

var workoutlist = function() {
    return [
        {
            "frequency": 3,
            "sequence": "Leg > Push > Pull > Leg > Push > Pull > Rest",
            "workout": [
                {
                    "id": Leg6,
                    "varname": "Leg6",
                    "name": "Leg Workout",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": Push6,
                    "varname": "Push6",
                    "name": "Push Workout",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": workout1day,
                    "varname": "workout1day",
                    "name": "Pull Workout",
                    "duration": '60-75 MINUTES'
                },
            ]
        },
        {
            "frequency": "Jessica",
            "sequence": "Leg > Push > Pull > Leg > Push > Pull > Rest",
            "workout": [
                {
                    "id": Leg6,
                    "varname": "Leg6",
                    "name": "Josh's Leg Day",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": Push6,
                    "varname": "Push6",
                    "name": "Josh's Chest Obliteration",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": workout1day,
                    "varname": "workout1day",
                    "name": "Pull Workout",
                    "duration": '60-75 MINUTES'
                },
            ]
        },
        {
            "frequency": 6,
            "sequence": "Leg > Push > Pull > Leg > Push > Pull > Rest",
            "workout": [{
                "id": Leg6,
                "varname": "Leg6",
                "name": "Leg Workout",
                "duration": '75-90 MINUTES'
            },
            {
                    "id": Push6,
                    "varname": "Push6",
                    "name": "Push Workout",
                    "duration": '75-90 MINUTES'
                },
            {
                "id": workout1day, "varname": "workout1day",
                "name": "Pull Workout",
                "duration": '60-75 MINUTES'
            },
        ]
        },
        {
            "frequency": "Cowboy",
            "sequence": "Leg > Push > Pull > Leg > Shoulder > Pull > Rest",
            "workout": [{
                "id": Leg6,
                "varname": "Leg6",
                "name": "Cowboy's Leg Destruction",
                "duration": '30-45 MINUTES'
            },
                {
                    "id": Push6,
                    "varname": "Push6",
                    "name": "Cowboy's Chest Annihilation",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": Pull6,
                    "varname": "Pull6",
                    "name": "Cowboy's Back Demolition",
                    "duration": '75-90 MINUTES'
                },
                {
                    "id": Shoulder6,
                    "varname": "Shoulder6",
                    "name": "Cowb's Shoulder Obliteration",
                    "duration": '75-90 MINUTES'
                },
            ]
        },

    ]
}

var Pull6 = [
    {
        "name": "Warm Up", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds60" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds, or "Check"
    },
    {
        "name": "Deadlift", // Exercise name on Quotes
        "sets": 4, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Weights and Reps" // "Weights and Reps", or "Seconds"
    },
    {
        "name": "Pull Up (Weighted)",
        "sets": 0,
        "warmup": 3,
        "type": "Weights and Reps"
    },
    {
        "name": "Yates Row",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Cable One Arm Row",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Trap Raises (DB)",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Bicep Curl (Bar)",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Hammer Curl (DB)",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Stretch", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds150" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds
    },
]

var Push6 = [
    {
        "name": "Warm Up", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds60" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds, or "Check"
    },
    {
        "name": "Bench Press", // Exercise name on Quotes
        "sets": 5, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Weights and Reps" // "Weights and Reps", or "Seconds"
    },
    {
        "name": "Machine Shoulder Press",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Dips (Weighted)",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Pec Deck",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Lateral Raise",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Skull Crusher",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Triceps Pushdown",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Stretch", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds150" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds
    },
]

var Shoulder6 = [
    {
        "name": "Warm Up", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds60" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds, or "Check"
    },
    {
        "name": "Overhead Press", // Exercise name on Quotes
        "sets": 5, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Weights and Reps" // "Weights and Reps", or "Seconds"
    },
    {
        "name": "Incline Bench Press",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Dips (Weighted)",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Pec Deck",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Lateral Raise",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Skull Crusher",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Triceps Pushdown",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Stretch", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds150" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds
    },
]

var Leg6 = [
    {
        "name": "Warm Up", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds60" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds, or "Check"
    },
    {
        "name": "Squat", // Exercise name on Quotes
        "sets": 4, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Weights and Reps" // "Weights and Reps", or "Seconds"
    },
    {
        "name": "Romanian Leg Deadlift",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Lunges",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Leg Extension",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Leg Raises",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Cable Crunch",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Stretch", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds150" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds
    },
]


var workout1day = [
    {
        "name": "Warm Up", // Exercise name on Quotes
        "sets": 0, // Number of sets
        "warmup": 1, // 0 for no warmup sets, 1 for one warmup set
        "type": "Seconds180" // "Weights and Reps" or "Seconds180", 180 being the amount of seconds
    },
    {
        "name": "Bench Press", // Exercise name on Quotes
        "sets": 5, // Number of sets
        "warmup": 0, // 0 for no warmup sets, 1 for one warmup set
        "type": "Weights and Reps" // "Weights and Reps", or "Seconds"
    },
    {
        "name": "Machine Shoulder Press",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Dips",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Pec Deck",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Lateral Raise",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
    {
        "name": "Triceps Pushdown",
        "sets": 3,
        "warmup": 0,
        "type": "Weights and Reps"
    },
]