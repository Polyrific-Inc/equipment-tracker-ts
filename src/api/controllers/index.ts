/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Controllers Index - Central export for all controller classes
 */

import { EquipmentController } from './equipment.controller.js';
import { FleetController } from './fleet.controller.js';
import { GeofenceController } from './geofence.controller.js';
import { PositionController } from './position.controller.js';

// Export all controller classes
export { EquipmentController } from './equipment.controller.js';
export { FleetController } from './fleet.controller.js';
export { PositionController } from './position.controller.js';
export { GeofenceController } from './geofence.controller.js';

// Controller factory types
export interface ControllerDependencies {
  equipmentService: import('../../services/equipment.service.js').IEquipmentService;
  alertService: import('../../services/alert.service.js').IAlertService;
  appService: import('../../services/app.service.js').IAppService;
  positionRepository: import('../../repositories/position.repository.js').IPositionRepository;
  gpsTrackingService: import('../../services/gps-tracking.service.js').IGpsTrackingService;
}

/**
 * Controller factory - creates all controllers with their dependencies
 */
export const createControllers = (dependencies: ControllerDependencies) => {
  const equipmentController = new EquipmentController(dependencies.equipmentService);

  const fleetController = new FleetController(
    dependencies.equipmentService,
    dependencies.alertService,
    dependencies.appService,
  );

  const positionController = new PositionController(
    dependencies.positionRepository,
    dependencies.gpsTrackingService,
    dependencies.appService,
  );

  const geofenceController = new GeofenceController(dependencies.alertService);

  return {
    equipmentController,
    fleetController,
    positionController,
    geofenceController,
  };
};

/**
 * Controller types for type safety
 */
export type Controllers = ReturnType<typeof createControllers>;
