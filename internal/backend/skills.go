package backend

import (
	lcx "github.com/edynasty/LumenCortex/runtime"
)

type Skill = lcx.Skill

func (r *Runtime) Skills(scope string) ([]Skill, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.Skills(scope)
}

func (r *Runtime) SkillContent(scope, id string) (string, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return "", ErrNoWorkspace
	}
	return engine.SkillContent(scope, id)
}

func (r *Runtime) SaveSkill(scope, id, content string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.SaveSkill(scope, id, content)
}

func (r *Runtime) DeleteSkill(scope, id string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.DeleteSkill(scope, id)
}

func (r *Runtime) SetSkillEnabled(scope, id string, enabled bool) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.SetSkillEnabled(scope, id, enabled)
}
