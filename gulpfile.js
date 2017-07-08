'use strict';

const gulp = require('gulp');
const mocha = require('gulp-mocha');
const gutil = require('gulp-util');
const eslint = require('gulp-eslint');

const sourceFiles = ['lib/**/*.js', 'bin/**/*.js'];
const testSourceFiles = ['test/**/**.spec.js'];
const allSourceFiles = sourceFiles.concat(testSourceFiles);

gulp.task('test', () =>
  gulp.src(testSourceFiles)
    .pipe(mocha())
    .on('error', gutil.log)
);

gulp.task('lint', () =>
  gulp.src(allSourceFiles)
    .pipe(eslint({fix: true}))
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

gulp.task('default', ['lint', 'test']);
