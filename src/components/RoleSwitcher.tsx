import React from 'react';
import type { TraineeRole } from '../types/tactical';
import { TRAINEE_ROLES } from '../services/scenarioEngine';
import { Users, Shield, Plane, Cpu, ShieldAlert } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: TraineeRole;
  onSelectRole: (role: TraineeRole) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, onSelectRole }) => {
  const getRoleIcon = (roleId: TraineeRole['id']) => {
    switch (roleId) {
      case 'SUB_UNIT_CDR':
        return <Shield size={14} />;
      case 'AIR_CONTROLLER':
        return <Plane size={14} />;
      case 'EW_CYBER_OFFICER':
        return <Cpu size={14} />;
      case 'INSTRUCTOR_WHITE_CELL':
        return <ShieldAlert size={14} />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(5, 15, 25, 0.9)',
      border: '1px solid rgba(0, 229, 255, 0.3)',
      borderRadius: '6px',
      padding: '4px 6px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 6px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#80deea',
        letterSpacing: '1px',
      }}>
        <Users size={13} color="#00e5ff" />
        <span>ROLE:</span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {TRAINEE_ROLES.map((role) => {
          const isActive = role.id === currentRole.id;
          return (
            <button
              key={role.id}
              onClick={() => onSelectRole(role)}
              title={`${role.rank} - ${role.responsibilities}`}
              style={{
                background: isActive ? `${role.badgeColor}33` : 'transparent',
                border: `1px solid ${isActive ? role.badgeColor : 'rgba(255, 255, 255, 0.15)'}`,
                color: isActive ? role.badgeColor : '#90a4ae',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              {getRoleIcon(role.id)}
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>
                {role.title.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
