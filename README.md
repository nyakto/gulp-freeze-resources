# gulp-freeze-resources
> A resource freezer plugin for gulp

## Usage

First, install `gulp-freeze-resources` as a development dependency:

```shell
npm install --save-dev gulp-freeze-resources
```

Then, add it to your `gulpfile.js`:

```javascript
var gulp = require('gulp');
var concat = require('gulp-concat');
var Freezer = require('gulp-freeze-resources');
var freezer = null;

gulp.task('styles', function () {
    freezer = new Freezer();
    return gulp.src('src/**/*.css')
        .pipe(freezer.freeze())
        .pipe(concat('styles.css'))
        .pipe(gulp.dest('build/public'));
});

gulp.task('resources', ['styles'], function () {
    return freezer.resources()
        .pipe(freezer.rename())
        .pipe(gulp.dest('build/public'));
});
```

It is important to add styles task as dependency for resources task!
