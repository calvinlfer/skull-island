'use strict';

const gulp = require('gulp');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const gutil = require('gulp-util');
const eslint = require('gulp-eslint');

const sourceFiles = ['index.js', 'lib/**/*.js', 'bin/index.js'];
const testSourceFiles = ['test/**/**.spec.js'];
const allSourceFiles = sourceFiles.concat(testSourceFiles);

gulp.task('test', done => {
  gulp.src(sourceFiles)
    .pipe(istanbul())                     // Covering files
    .pipe(istanbul.hookRequire())         // Force `require` to return covered files
    .on('finish', function () {
      return gulp.src(testSourceFiles)
        .pipe(mocha())
        .on('error', gutil.log)
        .pipe(istanbul.writeReports())    // Creating the reports after tests ran
        .pipe(istanbul.enforceThresholds({thresholds: {global: 100}})) // Enforce a coverage of at least 100%
        .on('end', done);

    })
    .on('error', gutil.log);
});

gulp.task('lint', _ => {
  return gulp.src(allSourceFiles)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', ['lint']);
