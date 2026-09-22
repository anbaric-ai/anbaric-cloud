import {User} from "./User";
import {DirectoryUser, UserDirectory} from "./UserDirectory";

class InMemoryUserDirectory implements UserDirectory {

    private users = new Map<string, DirectoryUser>();

    async record(user : User) : Promise<void> {
        const now = new Date().toISOString();
        const existing = this.users.get(user.id);
        this.users.set(user.id, {
            id: user.id,
            name: user.name ?? "",
            email: user.email ?? "",
            picture: user.picture,
            firstSeenAt: existing?.firstSeenAt ?? now,
            lastSeenAt: now,
        });
    }

    async list() : Promise<Array<DirectoryUser>> {
        return Array.from(this.users.values())
            .map(user => ({ ...user }))
            .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    }

}

export { InMemoryUserDirectory }
