/*
  Angular Moment.js Moment Picker
*/

// TODO: A concept of 'interval' instead of 'unit', and a way of setting the display bounds? E.g., mid-month month-end picker.

'use strict';

angular.module('moment')

.directive('momentPicker', ['$moment', '$log', 'indexOf', function inputDirective($moment, $log, indexOf) {
  var weekStartDay = $moment().startOf('week').format('d'),
      weekEndDay   = $moment().endOf('week')  .format('d'),
      getTemplateDefinition = function(templateName) {
        return $moment.$$pickerTemplates[templateName || 'default'];
      };

  return {
    restrict: 'A',
    templateUrl: function(tElement, tAttrs) {
      var template = getTemplateDefinition(tAttrs.template);
      if (template)
        return template.url;
      // Ya dun' goofed.
      $log.error('Error: [momentDatepicker] Picker template \''+ tAttrs.template +'\' is undefined. Templates must be defined with \'$momentProvider.definePickerTemplate\'.');
    },
    scope: {
      dateModel:   '=momentPicker',
      format:      '=?',
      modelFormat: '=?',
      min:         '=?',
      max:         '=?',
      ngShow:      '=?'
    },
    link: function(scope, element, attr) {
      var templateUnit = getTemplateDefinition(attr.template).unit,
          format       = $moment.$defaultModelFormat,
          moments      = {};

      // Initialize
      //////////////
      scope.hasNgShowAttr = !!attr.ngShow;

      if (!attr.ngShow)
        scope.ngShow = true;

      scope.displayMoment = $moment();
      scope.weekMoments   = [];

      var i = 7;
      while (i--)
        scope.weekMoments.unshift($moment().startOf('week').add(i, 'day'));

      // Process Format or modelFormat Attr
      //////////////////////////////////////

      var setFormat = function(newFormat) {
        if (angular.equals(format, newFormat))
          return;

        format = newFormat || $moment.$defaultModelFormat;
        parseDateModel(scope.dateModel);
      };

      if (attr.format && !attr.modelFormat) {
        format = scope.format || $moment.$defaultModelFormat;
        scope.$watch('format', setFormat);
      }
      else if (attr.modelFormat) {
        format = scope.modelFormat || $moment.$defaultModelFormat;
        scope.$watch('modelFormat', setFormat);
      }

      // Process Min/Max Attrs
      /////////////////////////

      var setMomentFromAttr = function(attrName, attrValue) {
        var moment;

        // Parse
        if (angular.isArray(attrValue) && attrValue.length == 2)
          moment = $moment(attrValue[0], attrValue[1], true);
        else if (attrValue && angular.isString(attrValue)) {
          if (attrValue == 'today')
            moment = $moment();
          else
            moment = $moment(attrValue, $moment.$defaultModelFormat);
        }
        else
          moment = $moment(null);

        // Set
        moments[attrName] = moment.isValid() ? moment : null;
      };

      if (attr.min) {
        scope.$watch('min', function(minValue) {
          setMomentFromAttr('min', minValue);
        }, true);
      }

      if (attr.max) {
        scope.$watch('max', function(maxValue) {
          setMomentFromAttr('max', maxValue);
        }, true);
      }


      // View helpers
      ////////////////

      scope.getClasses = function(moment, classes) {
        var isWeekend   = /6|7/.test(moment.isoWeekday()),
            isWeekday   = !isWeekend,
            classObject = {
              weekend: isWeekend,
              weekday: isWeekday
            };

        // Convenience classes: jan fri
        classObject[ moment.format('MMM ddd').toLowerCase() ] = true;

        if (!classes)
          return classObject;

        angular.forEach(classes.split(' '), function(className) {
          var name = className.split('-')[0],
              unit = className.split('-')[1] || templateUnit;

          if (name == 'picked')
            classObject[className] = moment.isSame(scope.dateMoment, templateUnit);

          else if (name == 'current')
            classObject[className +' current'] = moment.isSame(scope.today, unit);

          else if (name == 'invalid' && (moments.min || moments.max)) {
            if (moments.min && moment.isBefore(moments.min, unit))
              classObject[className + ' invalid'] = true;
            else if (moments.max && moment.isAfter(moments.max, unit))
              classObject[className + ' invalid'] = true;
          }

        });

        return classObject;
      };

      scope.setDateTo = function(moment) {
        if (moments.min && moment.isBefore(moments.min, templateUnit))
          return;
        if (moments.max && moment.isAfter(moments.max, templateUnit))
          return;

        // Clamp it to the min/max to keep it valid
        if (moments.min)
          moment = moment.min(moments.min);
        if (moments.max)
          moment = moment.max(moments.max);

        scope.dateModel = moment.format(format);

        if (scope.hasNgShowAttr)
          scope.ngShow = false;
      };


      // Core things
      ///////////////

      var parseDateModel = function(dateModel) {
        var moment = $moment(dateModel, format, $moment.$strictModel);

        if (dateModel && moment.isValid()) {
          scope.dateMoment    = moment.clone();
          scope.displayMoment = moment.clone();
        }
        else {
          scope.dateMoment    = $moment('');
          scope.displayMoment = $moment();
        } 
      };

      scope.$watch('dateModel', parseDateModel);

      scope.$watch(function() { return scope.displayMoment.format('M/YYYY'); }, function(moment, oldMoment) {
        rebuild();
      });

      function rebuild() {
        scope.today = $moment();
        scope.lastMonthMoments = [];
        scope.thisMonthMoments = [];
        scope.nextMonthMoments = [];
        scope.monthsThisYearMoments = [];

        var lastMonthMoment = scope.displayMoment.clone().startOf('month'),
            thisMonthMoment = lastMonthMoment.clone(),
            nextMonthMoment = scope.displayMoment.clone().endOf('month'),
            thisMonth       = scope.displayMoment.format('M'),
            thisYear        = scope.displayMoment.format('YYYY');

        while (lastMonthMoment.format('d') !== weekStartDay)
          scope.lastMonthMoments.unshift(lastMonthMoment.subtract(1, 'day').clone());

        while (thisMonthMoment.format('M') === thisMonth) {
          scope.thisMonthMoments.push(thisMonthMoment.clone());
          thisMonthMoment.add(1, 'day');
        }

        while (scope.lastMonthMoments.length + scope.thisMonthMoments.length + scope.nextMonthMoments.length < 42)
          scope.nextMonthMoments.push(nextMonthMoment.add(1, 'day').clone());

        while (scope.monthsThisYearMoments.length < 12)
          scope.monthsThisYearMoments.push(moment({ year:thisYear, month:scope.monthsThisYearMoments.length }));

      }

    }
  };

}])


// Picker extends moment input directive with positioned momentPicker

.directive('picker', ['$moment', '$compile', 'getOffset', function inputDirective($moment, $compile, getOffset) {
  var defaultStyleAttr = 'style="position:absolute" class="input-picker"',
      copiedAttrs      = 'format modelFormat min max'.split(' ');

  var toSpinalCase = function(string) {
    return string.replace(/[a-z][A-Z]/g, function(w) { return w[0] +'-'+ w[1]; }).toLowerCase();
  };

  return {
    restrict: 'A',
    require: '?ngModel',
    link: function(scope, element, attr, ctrl) {
      if (!ctrl || attr.type !== 'moment')
        return;

      var pickerAttrs = [ defaultStyleAttr ];

      // Copy relevent attrs from input to picker
      if (attr.picker)
        pickerAttrs.push('template='+ attr.picker);

      angular.forEach(copiedAttrs, function(name) {
        if (attr[name])
          pickerAttrs.push(toSpinalCase(name) +'="'+ attr[name] +'"');
      });

      // 'ngShow' state tracking
      if (!scope.$momentPicker)
        scope.$momentPicker = {};
      scope.$momentPicker[attr.ngModel] = false;
      pickerAttrs.push('ng-show="$momentPicker[\''+ attr.ngModel +'\']"');

      // Compile/inject/bind events to picker
      var pickerElement = $compile('<div moment-picker="'+ attr.ngModel +'" '+ pickerAttrs.join(' ') +'></div>')(scope);
      angular.element(document.body).append(pickerElement);

      pickerElement.on('mousedown', function(event) {
        event.preventDefault();
      });

      // Input event binding
      element.on('focus click', function(event) {
        var offset = getOffset(element[0]);
  
        pickerElement.css({
          left: offset.left + 'px',
          top: offset.bottom + 'px'
        });

        scope.$apply(function(scope) {
          scope.$momentPicker[attr.ngModel] = true;
        });
      });

      element.on('blur keydown', function(event) {
        if (event.type == 'keydown' && event.which !== 27)
          return;
        scope.$apply(function(scope) {
          scope.$momentPicker[attr.ngModel] = false;
        });
      });

      // Destruction cleanup
      scope.$on('$destroy', function() {
        pickerElement.off().remove();
      });

    }
  };
}]);

