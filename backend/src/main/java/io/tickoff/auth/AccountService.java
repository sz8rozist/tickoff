package io.tickoff.auth;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AccountService {

    private final UserRepository users;
    private final ProjectRepository projects;

    public AccountService(UserRepository users, ProjectRepository projects) {
        this.users = users;
        this.projects = projects;
    }

    /**
     * Törli a felhasználót és a saját projektjeit. A körök és kommentek törlését az adatbázis
     * ON DELETE CASCADE-je végzi.
     *
     * @return a törölt projektek azonosítói, a hívó ezek képernyőképeit is törli a fájlrendszerből
     */
    @Transactional
    public List<Long> deleteAccount(User user) {
        List<Project> owned = projects.findByOwnerIdOrderByCreatedAtDesc(user.getId());
        List<Long> projectIds = owned.stream().map(Project::getId).toList();
        projects.deleteAll(owned);
        users.delete(user);
        return projectIds;
    }
}
