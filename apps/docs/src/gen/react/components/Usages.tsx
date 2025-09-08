import React from 'react';
import { ArrowIcon } from './Icon';

interface Usage {
  name: string;
  icon: string;
  content: string;
  additionalCss?: string;
}

interface UsagesProps {
  usages: Usage[];
  composed?: boolean;
}

export const Usages: React.FC<UsagesProps> = ({ usages, composed = false }) => {
  if (!composed) {
    return (
      <div className="usageContent">
        <h3>Usage</h3>
        <div dangerouslySetInnerHTML={{ __html: usages[0]?.content || '' }} />
      </div>
    );
  }

  return (
    <div className="usages">
      {usages.map((usage, index) => (
        <React.Fragment key={usage.name}>
          {usage.additionalCss && (
            <style scoped>
              <div dangerouslySetInnerHTML={{ __html: usage.additionalCss }} />
            </style>
          )}
          <input 
            type="radio" 
            name="usage" 
            id={usage.name}
            className="hidden" 
            defaultChecked={index === 0}
          />
        </React.Fragment>
      ))}

      <nav>
        <h3 className="!mb-0">Use with</h3>
        
        <details id="usageSelector">
          <summary>
            {usages.map((usage) => (
              <div key={`${usage.name}_active_dropdown`} id={`${usage.name}_active_dropdown`} className="hidden items-center gap-1">
                <div className="h-4 *:h-4 *:w-auto flex-none">
                  <div dangerouslySetInnerHTML={{ __html: usage.icon }} />
                </div>
                <div className="leading-none">{usage.name}</div>
              </div>
            ))}

            <div className="rotate-90">
              <ArrowIcon />
            </div>
          </summary>

          <div>
            <div>
              {usages.map((usage) => (
                <label key={usage.name} htmlFor={usage.name}>
                  <div className="h-5 *:h-5 *:w-auto flex-none">
                    <div dangerouslySetInnerHTML={{ __html: usage.icon }} />
                  </div>
                  <div>{usage.name}</div>
                </label>
              ))}
            </div>
          </div>
        </details>
      </nav>

      <div>
        {usages.map((usage) => (
          <div key={`${usage.name}_content`} id={`${usage.name}_content`} className="usageContent">
            <div dangerouslySetInnerHTML={{ __html: usage.content }} />
          </div>
        ))}
      </div>
    </div>
  );
};