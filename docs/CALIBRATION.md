# Calibration and scoring stability

The goal is for an 8.0 today to mean approximately the same thing as an 8.0 after a model or code update.

## Reference set

Build a permanent calibration set of about 25 consented sample speeches. The set should deliberately include:

- Levels 1 through 5
- high and low overall quality
- strong content with weak structure
- strong structure with shallow content
- quiet and well-projected voices
- monotone and expressive delivery
- many fillers and almost no fillers
- multiple long pauses
- repeated restarts
- clear and unclear word endings
- early finishes
- a speech that is still mid-thought at 60 seconds
- invalid audio, such as dominant background speech or failed capture

Do not use a child's personal production history as a hidden calibration corpus unless the parent deliberately chooses to retain those recordings for testing. V1 does not retain production audio.

## Gold scores

For each calibration speech, establish agreed category scores and notes. Example:

```text
Structure  8.0
Content    5.5
Clarity    9.0
Fluency    6.0
Delivery   7.5
Overall    7.0
```

Also record expected objective values where practical, particularly filler count, long pause count, approximate speaking duration, and broad volume/pitch assessments.

## Acceptance rule before a model or rubric change

- A 0.5 movement in an individual category can be acceptable if it is not systematic.
- A movement of 1.0 or more should be reviewed.
- If many samples move in the same direction, do not deploy until the cause is understood.
- Deterministic metrics should remain more stable than subjective categories.
- Progression unit tests must remain green.

## Versioning

Every stored speech records:

- rubric version
- transcription model
- audio model
- scoring model

Change `RUBRIC_VERSION` when the scoring rules themselves change. Model aliases are configured as environment variables so they can be updated separately from the application code.

## Recommended release check

Before changing a production scoring model:

1. Run all automated tests.
2. Run the full calibration set on the existing production configuration.
3. Run the same set on the proposed configuration.
4. Compare category-level deltas, not only overall score.
5. Manually review any 1.0+ category movement.
6. Deploy only after the differences are understood and acceptable.
