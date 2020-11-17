import { baseContext } from '../contexts';
import { unitTestMozart } from './mozart/MozartUnit';

baseContext('Unit Tests', function () {
  unitTestMozart();
});
